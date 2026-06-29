package com.attendance.service;

import com.attendance.dto.AttendanceSheetEntryDto;
import com.attendance.dto.SessionReportDto;
import com.attendance.dto.SubjectAttendanceDto;
import com.attendance.entity.*;
import com.attendance.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ReportsService — aggregation layer for Phase 7 analytics.
 *
 * Provides:
 *  1. Student report: per-subject attendance % with low-attendance flags
 *  2. Session report: full attendance sheet for a single class session
 *  3. Teacher report: all session summaries for a teacher
 *  4. Admin overview: branch-wise stats, system totals
 *  5. CSV export: formatted attendance sheet as comma-separated string
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class ReportsService {

    private static final double LOW_ATTENDANCE_THRESHOLD = 75.0;

    private final StudentRepository              studentRepository;
    private final TeacherRepository              teacherRepository;
    private final ClassSessionRepository         classSessionRepository;
    private final AttendanceRecordRepository     attendanceRecordRepository;
    private final SubjectRepository              subjectRepository;
    private final YearRepository                 yearRepository;

    // ── 1. Student Report ──────────────────────────────────────────

    /**
     * Returns per-subject attendance stats for the student identified by email.
     * Includes: total sessions, present count, absent count, %, low-attendance flag.
     */
    public List<SubjectAttendanceDto> getStudentReport(String studentEmail) {
        Student student = studentRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Student not found: " + studentEmail));

        return buildStudentSubjectReport(student);
    }

    /**
     * Admin-initiated lookup: get report by student UUID.
     */
    public List<SubjectAttendanceDto> getStudentReportById(UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NoSuchElementException("Student not found: " + studentId));
        return buildStudentSubjectReport(student);
    }

    // ── 2. Session Report ──────────────────────────────────────────

    /**
     * Returns the complete attendance sheet for one session.
     * Fetches student details in a single JOIN query to avoid N+1.
     */
    public SessionReportDto getSessionReport(UUID sessionId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NoSuchElementException("Session not found: " + sessionId));

        List<AttendanceRecord> records = attendanceRecordRepository
                .findBySessionIdWithStudentDetails(sessionId);

        // Build the per-student entry list
        List<AttendanceSheetEntryDto> entries = records.stream()
                .map(this::toSheetEntry)
                .sorted(Comparator.comparing(AttendanceSheetEntryDto::getFullName))
                .collect(Collectors.toList());

        long presentCount = entries.stream().filter(e -> "PRESENT".equals(e.getStatus())).count();
        int totalStudents = entries.size();
        double pct = totalStudents > 0 ? (100.0 * presentCount / totalStudents) : 0.0;

        return SessionReportDto.builder()
                .sessionId(session.getId())
                .sessionTitle(session.getTitle())
                .subjectName(session.getSubject() != null ? session.getSubject().getName() : "—")
                .subjectCode(session.getSubject() != null ? session.getSubject().getCode() : "—")
                .teacherName(session.getTeacher() != null ? session.getTeacher().getFullName() : "—")
                .scheduledAt(session.getScheduledAt())
                .startedAt(session.getStartedAt())
                .endedAt(session.getEndedAt())
                .status(session.getStatus().name())
                .totalStudents(totalStudents)
                .presentCount((int) presentCount)
                .absentCount(totalStudents - (int) presentCount)
                .attendancePercentage(Math.round(pct * 10.0) / 10.0)
                .entries(entries)
                .build();
    }

    // ── 3. Teacher Report ──────────────────────────────────────────

    /**
     * Returns all session summaries for a teacher (without full entry lists for performance).
     * Teacher sees: session title, subject, date, present/absent counts, %.
     */
    public List<SessionReportDto> getTeacherSessionReports(String teacherEmail) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Teacher not found: " + teacherEmail));

        List<ClassSession> sessions = classSessionRepository
                .findByTeacherIdOrderByScheduledAtDesc(teacher.getId());

        return sessions.stream()
                .map(session -> {
                    List<AttendanceRecord> records = attendanceRecordRepository
                            .findBySessionId(session.getId());
                    long presentCount = records.stream()
                            .filter(r -> r.getStatus() == AttendanceStatus.PRESENT).count();
                    int total = records.size();
                    double pct = total > 0 ? (100.0 * presentCount / total) : 0.0;

                    return SessionReportDto.builder()
                            .sessionId(session.getId())
                            .sessionTitle(session.getTitle())
                            .subjectName(session.getSubject() != null ? session.getSubject().getName() : "—")
                            .subjectCode(session.getSubject() != null ? session.getSubject().getCode() : "—")
                            .teacherName(teacher.getFullName())
                            .scheduledAt(session.getScheduledAt())
                            .startedAt(session.getStartedAt())
                            .endedAt(session.getEndedAt())
                            .status(session.getStatus().name())
                            .totalStudents(total)
                            .presentCount((int) presentCount)
                            .absentCount(total - (int) presentCount)
                            .attendancePercentage(Math.round(pct * 10.0) / 10.0)
                            .build(); // No entries for list view — fetch on-demand
                })
                .collect(Collectors.toList());
    }

    // ── 4. Admin Overview ──────────────────────────────────────────

    /**
     * System-wide stats for the admin reports page.
     */
    public Map<String, Object> getAdminOverview() {
        long totalStudents  = studentRepository.count();
        long totalSessions  = classSessionRepository.count();
        long enrolledStudents = studentRepository.countByFaceEnrolledTrue();

        // Total present records
        long totalPresent = attendanceRecordRepository.countByStatus(AttendanceStatus.PRESENT);
        long totalAbsent  = attendanceRecordRepository.countByStatus(AttendanceStatus.ABSENT);
        long totalRecords = totalPresent + totalAbsent;

        double overallPct = totalRecords > 0 ? (100.0 * totalPresent / totalRecords) : 0.0;

        // Per-branch stats
        List<Year> years = yearRepository.findAll();
        List<Map<String, Object>> branchStats = years.stream()
                .collect(Collectors.groupingBy(
                    y -> y.getBranch().getName(),
                    Collectors.toList()
                ))
                .entrySet().stream()
                .map(entry -> {
                    String branchName = entry.getKey();
                    List<Year> branchYears = entry.getValue();

                    long branchStudents = branchYears.stream()
                            .mapToLong(y -> studentRepository.countByYearId(y.getId()))
                            .sum();

                    Map<String, Object> stat = new LinkedHashMap<>();
                    stat.put("branchName", branchName);
                    stat.put("totalStudents", branchStudents);
                    return stat;
                })
                .sorted(Comparator.comparing(m -> m.get("branchName").toString()))
                .collect(Collectors.toList());

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("totalStudents",     totalStudents);
        overview.put("enrolledStudents",  enrolledStudents);
        overview.put("totalSessions",     totalSessions);
        overview.put("totalPresentMarks", totalPresent);
        overview.put("totalAbsentMarks",  totalAbsent);
        overview.put("overallAttendancePct", Math.round(overallPct * 10.0) / 10.0);
        overview.put("branchStats",       branchStats);
        return overview;
    }

    // ── 5. CSV Export ──────────────────────────────────────────────

    /**
     * Generates a CSV string for a session attendance sheet.
     * Returns the string — caller sets Content-Disposition: attachment response header.
     */
    public String exportSessionCsv(UUID sessionId) {
        SessionReportDto report = getSessionReport(sessionId);

        StringBuilder csv = new StringBuilder();
        csv.append("Smart Attendance System — Session Report\n");
        csv.append("Session:,").append(escape(report.getSessionTitle())).append("\n");
        csv.append("Subject:,").append(escape(report.getSubjectName()))
           .append(" (").append(report.getSubjectCode()).append(")\n");
        csv.append("Teacher:,").append(escape(report.getTeacherName())).append("\n");
        csv.append("Date:,").append(report.getScheduledAt()).append("\n");
        csv.append("Present:,").append(report.getPresentCount()).append(" / ")
           .append(report.getTotalStudents()).append("\n");
        csv.append("Attendance %:,").append(report.getAttendancePercentage()).append("%\n");
        csv.append("\n");
        csv.append("Roll Number,Full Name,Branch,Year,Status,Marked At,Face Similarity,Liveness,Verification\n");

        for (AttendanceSheetEntryDto e : report.getEntries()) {
            csv.append(escape(e.getRollNumber())).append(",");
            csv.append(escape(e.getFullName())).append(",");
            csv.append(escape(e.getBranchName())).append(",");
            csv.append(escape(e.getYearLabel())).append(",");
            csv.append(e.getStatus()).append(",");
            csv.append(e.getMarkedAt() != null ? e.getMarkedAt().toString() : "—").append(",");
            csv.append(e.getFaceSimilarity() != null
                ? e.getFaceSimilarity().multiply(new java.math.BigDecimal("100")).setScale(1, java.math.RoundingMode.HALF_UP) + "%"
                : "—").append(",");
            csv.append(e.isLivenessPassed() ? "✓" : "—").append(",");
            csv.append(escape(e.getVerificationMethod() != null ? e.getVerificationMethod() : "—")).append("\n");
        }

        return csv.toString();
    }

    // ── Private Helpers ────────────────────────────────────────────

    private List<SubjectAttendanceDto> buildStudentSubjectReport(Student student) {
        // Get all subjects this student's year group covers
        Year year = student.getYear();
        if (year == null) return Collections.emptyList();

        List<Subject> subjects = subjectRepository.findByYearId(year.getId());

        return subjects.stream()
                .map(subject -> {
                    List<Object[]> statRows = attendanceRecordRepository
                            .getAttendanceStatsForStudentAndSubject(student.getId(), subject.getId());

                    // Query returns a single aggregate row; guard against no-data case
                    Object[] stats = (statRows != null && !statRows.isEmpty()) ? statRows.get(0) : new Object[]{0L, 0L};

                    long total   = stats[0] != null ? ((Number) stats[0]).longValue() : 0L;
                    long present = stats[1] != null ? ((Number) stats[1]).longValue() : 0L;
                    long absent  = total - present;
                    double pct   = total > 0 ? (100.0 * present / total) : 0.0;

                    return SubjectAttendanceDto.builder()
                            .subjectId(subject.getId())
                            .subjectName(subject.getName())
                            .subjectCode(subject.getCode())
                            .totalSessions((int) total)
                            .presentCount((int) present)
                            .absentCount((int) absent)
                            .percentage(Math.round(pct * 10.0) / 10.0)
                            .belowThreshold(pct < LOW_ATTENDANCE_THRESHOLD && total > 0)
                            .build();
                })
                .sorted(Comparator.comparing(SubjectAttendanceDto::getSubjectName))
                .collect(Collectors.toList());
    }

    private AttendanceSheetEntryDto toSheetEntry(AttendanceRecord r) {
        Student s = r.getStudent();
        return AttendanceSheetEntryDto.builder()
                .studentId(s.getId())
                .fullName(s.getFullName())
                .rollNumber(s.getRollNumber())
                .branchName(s.getYear() != null && s.getYear().getBranch() != null
                    ? s.getYear().getBranch().getName() : "—")
                .yearLabel(s.getYear() != null ? s.getYear().getLabel() : "—")
                .status(r.getStatus().name())
                .markedAt(r.getMarkedAt())
                .faceSimilarity(r.getFaceSimilarity())
                .livenessPassed(Boolean.TRUE.equals(r.getLivenessPassed()))
                .verificationMethod(r.getVerificationMethod())
                .build();
    }

    private String escape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
