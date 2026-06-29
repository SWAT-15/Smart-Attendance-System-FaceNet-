package com.attendance.repository;

import com.attendance.entity.QrAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository for the QrAuditLog entity.
 * Append-only — never used for updates or deletes.
 */
@Repository
public interface QrAuditLogRepository extends JpaRepository<QrAuditLog, Long> {

    /** All audit entries for a session (sorted newest first). */
    List<QrAuditLog> findBySessionIdOrderByAttemptAtDesc(UUID sessionId);

    /** Check for replay attacks — has this exact token been used successfully? */
    boolean existsByQrTokenAndSuccessTrue(String qrToken);

    /** All failed attempts from a specific IP (fraud detection). */
    @Query("SELECT q FROM QrAuditLog q " +
           "WHERE q.ipAddress = :ip " +
           "AND q.success = false " +
           "AND q.attemptAt > :since " +
           "ORDER BY q.attemptAt DESC")
    List<QrAuditLog> findRecentFailuresByIp(
        @Param("ip")    String ip,
        @Param("since") LocalDateTime since
    );

    /** Count of failures for a student in the last N minutes (rate limiting). */
    @Query("SELECT COUNT(q) FROM QrAuditLog q " +
           "WHERE q.student.id = :studentId " +
           "AND q.success = false " +
           "AND q.attemptAt > :since")
    long countRecentFailuresByStudent(
        @Param("studentId") UUID studentId,
        @Param("since")     LocalDateTime since
    );
}
