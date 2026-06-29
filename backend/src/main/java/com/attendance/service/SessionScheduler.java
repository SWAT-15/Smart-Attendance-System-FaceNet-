package com.attendance.service;

import com.attendance.entity.ClassSession;
import com.attendance.entity.SessionStatus;
import com.attendance.repository.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Scheduled task that rotates QR tokens for all ACTIVE sessions every 12 seconds.
 *
 * Why 12 seconds?
 *  - Short enough to prevent photo/screenshot replay attacks
 *  - Long enough for a student to open camera and scan once
 *  - Redis TTL is also set to 12s — token expires naturally if not used
 *
 * This component uses @EnableScheduling and is the sole place where
 * QR tokens are automatically rotated. The teacher's projector frontend
 * subscribes to /topic/session/{sessionId}/qr via STOMP WebSocket
 * and updates the displayed QR code on each QR_ROTATE event.
 */
@Component
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class SessionScheduler {

    private final ClassSessionRepository classSessionRepository;
    private final TeacherService teacherService;

    /**
     * Runs every 60 seconds (1 minute).
     * Finds all ACTIVE sessions, rotates their QR token, and broadcasts to WebSocket.
     */
    @Scheduled(fixedRate = 60_000)  // 60 seconds in milliseconds
    public void rotateAllActiveSessionTokens() {
        List<ClassSession> activeSessions = classSessionRepository.findByStatus(SessionStatus.ACTIVE);

        if (activeSessions.isEmpty()) {
            return; // Nothing to do — avoids noisy debug logs
        }

        log.debug("Rotating QR tokens for {} active session(s)...", activeSessions.size());

        for (ClassSession session : activeSessions) {
            try {
                teacherService.rotateAndBroadcast(session);
            } catch (Exception e) {
                // Don't let one failing session block others
                log.error("Failed to rotate QR for session {}: {}", session.getId(), e.getMessage());
            }
        }
    }
}
