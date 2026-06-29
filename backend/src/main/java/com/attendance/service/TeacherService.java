package com.attendance.service;

import com.attendance.dto.CreateSessionRequest;
import com.attendance.dto.SessionSummaryDto;
import com.attendance.entity.*;
import com.attendance.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Core business logic for the Teacher Portal.
 *
 * Responsibilities:
 *  1. Create and retrieve class sessions for a teacher
 *  2. Start / End a session (with access control checks)
 *  3. Generate rotating QR tokens and push them via WebSocket
 *  4. Auto-mark absent students when a session ends
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherService {

    private final ClassSessionRepository classSessionRepository;
    private final TeacherRepository teacherRepository;
    private final SubjectRepository subjectRepository;
    private final YearRepository yearRepository;
    private final StudentRepository studentRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final QrTokenService qrTokenService;
    private final SimpMessagingTemplate messagingTemplate;

    // ── Session Retrieval ─────────────────────────────────────────

    /** All sessions belonging to the currently logged-in teacher. */
    @Transactional(readOnly = true)
    public List<SessionSummaryDto> getMySessions(String teacherEmail) {
        Teacher teacher = resolveTeacher(teacherEmail);
        return classSessionRepository.findByTeacherIdOrderByScheduledAtDesc(teacher.getId())
                .stream()
                .map(this::toSummary)
                .toList();
    }

    /** Single session detail (ownership check included). */
    public ClassSession getSessionOwned(UUID sessionId, String teacherEmail) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NoSuchElementException("Session not found: " + sessionId));
        if (!session.getTeacher().getEmail().equals(teacherEmail)) {
            throw new IllegalArgumentException("You do not own this session.");
        }
        return session;
    }

    // ── Session Creation ──────────────────────────────────────────

    @Transactional
    public ClassSession createSession(CreateSessionRequest req, String teacherEmail) {
        Teacher teacher = resolveTeacher(teacherEmail);

        Subject subject = subjectRepository.findById(req.getSubjectId())
                .orElseThrow(() -> new NoSuchElementException("Subject not found: " + req.getSubjectId()));

        Year year = yearRepository.findById(req.getYearId())
                .orElseThrow(() -> new NoSuchElementException("Year not found: " + req.getYearId()));

        ClassSession session = ClassSession.builder()
                .title(req.getTitle())
                .room(req.getRoom())
                .subject(subject)
                .teacher(teacher)
                .year(year)
                .scheduledAt(req.getScheduledAt() != null ? req.getScheduledAt() : LocalDateTime.now())
                .status(SessionStatus.SCHEDULED)
                .build();

        ClassSession saved = classSessionRepository.save(session);
        log.info("Session created: '{}' for teacher: {}", saved.getTitle(), teacherEmail);
        return saved;
    }

    // ── Start Session ─────────────────────────────────────────────

    @Transactional
    public Map<String, Object> startSession(UUID sessionId, String teacherEmail) {
        ClassSession session = getSessionOwned(sessionId, teacherEmail);

        if (session.isActive()) {
            throw new IllegalArgumentException("Session is already active.");
        }

        session.start();
        classSessionRepository.save(session);

        // Generate first QR token and push to projector via WebSocket
        String token = rotateAndBroadcast(session);
        log.info("Session STARTED: {} by {}", sessionId, teacherEmail);

        return Map.of(
            "status", "ACTIVE",
            "sessionId", sessionId.toString(),
            "token", token,
            "tokenTtl", 60
        );
    }

    // ── End Session ───────────────────────────────────────────────

    @Transactional
    public Map<String, Object> endSession(UUID sessionId, String teacherEmail) {
        ClassSession session = getSessionOwned(sessionId, teacherEmail);

        if (!session.isActive()) {
            throw new IllegalArgumentException("Session is not currently active.");
        }

        // Auto-mark students who never scanned as ABSENT
        int absentCount = markAbsentStudents(session);

        session.end();
        classSessionRepository.save(session);

        // Evict token from Redis — no more scans accepted
        qrTokenService.invalidateToken(sessionId);

        // Notify projector that session ended
        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            Map.of(
                "type", "SESSION_ENDED",
                "sessionId", sessionId.toString(),
                "absentCount", absentCount,
                "presentCount", countPresent(session)
            )
        );

        log.info("Session ENDED: {} — {} absent", sessionId, absentCount);
        return Map.of("status", "COMPLETED", "absentCount", absentCount);
    }

    // ── QR Token Rotation ─────────────────────────────────────────

    /**
     * Generates a fresh QR token for the session and broadcasts it over WebSocket.
     * Called both on session start AND by the scheduler every 12 seconds.
     *
     * Payload broadcast to topic: /topic/session/{sessionId}/qr
     *   { type: "QR_ROTATE", token: "...", sessionId: "...", ttl: 12 }
     */
    public String rotateAndBroadcast(ClassSession session) {
        String token = qrTokenService.generateAndCacheToken(session.getId());

        // Persist ONLY the token field — a targeted UPDATE avoids merging a stale
        // entity snapshot that could accidentally overwrite the session status
        // (e.g. scheduler holds ACTIVE state while endSession just set COMPLETED).
        classSessionRepository.updateCurrentToken(session.getId(), token);

        // Push to teacher's projector WebSocket topic
        Map<String, Object> payload = Map.of(
            "type", "QR_ROTATE",
            "token", token,
            "sessionId", session.getId().toString(),
            "ttl", 60
        );
        messagingTemplate.convertAndSend(
            "/topic/session/" + session.getId() + "/qr", payload);

        log.debug("QR rotated for session {}", session.getId());
        return token;
    }

    /**
     * Called by the REST endpoint GET /teacher/sessions/qr/{sessionId}.
     * Used as WebSocket fallback (e.g. when browser loses WS connection).
     */
    @Transactional
    public Map<String, Object> getCurrentQrToken(UUID sessionId, String teacherEmail) {
        ClassSession session = getSessionOwned(sessionId, teacherEmail);
        if (!session.isActive()) {
            throw new IllegalArgumentException("Session is not active.");
        }
        String token = rotateAndBroadcast(session);
        return Map.of("token", token, "sessionId", sessionId.toString(), "ttl", 60);
    }

    // ── Attendance Summary ─────────────────────────────────────────

    /** Returns the live attendance list for a session (present students). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAttendanceFeed(UUID sessionId, String teacherEmail) {
        ClassSession session = getSessionOwned(sessionId, teacherEmail);
        return attendanceRecordRepository.findBySessionId(sessionId)
                .stream()
                .filter(r -> AttendanceStatus.PRESENT.equals(r.getStatus()))
                .map(r -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("studentId", r.getStudent().getId().toString());
                    entry.put("name", r.getStudent().getFullName());
                    entry.put("rollNumber", r.getStudent().getRollNumber());
                    entry.put("markedAt", r.getMarkedAt().toString());
                    return entry;
                })
                .toList();
    }

    // ── Private Helpers ───────────────────────────────────────────

    private Teacher resolveTeacher(String email) {
        return teacherRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Teacher not found: " + email));
    }

    private int markAbsentStudents(ClassSession session) {
        // Get all students in this year group
        List<Student> allStudents = studentRepository.findByYearId(session.getYear().getId());

        // Get IDs of students already marked PRESENT
        Set<UUID> presentIds = attendanceRecordRepository.findBySessionId(session.getId())
                .stream()
                .filter(r -> AttendanceStatus.PRESENT.equals(r.getStatus()))
                .map(r -> r.getStudent().getId())
                .collect(java.util.stream.Collectors.toSet());

        int absentCount = 0;
        for (Student student : allStudents) {
            if (!presentIds.contains(student.getId())) {
                AttendanceRecord absentRecord = AttendanceRecord.builder()
                        .session(session)
                        .student(student)
                        .status(AttendanceStatus.ABSENT)
                        .markedAt(LocalDateTime.now())
                        .verificationMethod("AUTO_ABSENT")
                        .build();
                attendanceRecordRepository.save(absentRecord);
                absentCount++;
            }
        }
        return absentCount;
    }

    private int countPresent(ClassSession session) {
        return (int) attendanceRecordRepository.findBySessionId(session.getId())
                .stream()
                .filter(r -> AttendanceStatus.PRESENT.equals(r.getStatus()))
                .count();
    }

    public SessionSummaryDto toSummary(ClassSession s) {
        int presentCount = (int) s.getAttendanceRecords().stream()
                .filter(r -> AttendanceStatus.PRESENT.equals(r.getStatus()))
                .count();

        return SessionSummaryDto.builder()
                .id(s.getId())
                .title(s.getTitle())
                .room(s.getRoom())
                .status(s.getStatus().name())
                .subjectName(s.getSubject() != null ? s.getSubject().getName() : "")
                .subjectCode(s.getSubject() != null ? s.getSubject().getCode() : "")
                .yearLabel(s.getYear() != null ? s.getYear().getLabel() : "")
                .branchName(s.getYear() != null && s.getYear().getBranch() != null
                        ? s.getYear().getBranch().getName() : "")
                .scheduledAt(s.getScheduledAt())
                .startedAt(s.getStartedAt())
                .presentCount(presentCount)
                .build();
    }
}
