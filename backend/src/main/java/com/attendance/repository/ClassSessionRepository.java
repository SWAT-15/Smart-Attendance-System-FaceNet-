package com.attendance.repository;

import com.attendance.entity.ClassSession;
import com.attendance.entity.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for ClassSession entity.
 * Provides queries needed for the teacher portal and QR engine.
 */
@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, UUID> {

    /** All sessions for a specific teacher. */
    List<ClassSession> findByTeacherId(UUID teacherId);

    /** All sessions for a teacher, newest first — used in teacher portal list view. */
    List<ClassSession> findByTeacherIdOrderByScheduledAtDesc(UUID teacherId);

    /** All active sessions (across all teachers). */
    List<ClassSession> findByStatus(SessionStatus status);

    /** Active sessions for a specific teacher (for projector view). */
    List<ClassSession> findByTeacherIdAndStatus(UUID teacherId, SessionStatus status);

    /** Sessions for a given year (students use this to know what's active). */
    List<ClassSession> findByYearIdAndStatus(UUID yearId, SessionStatus status);

    /**
     * Load a session with all related data in one query.
     * Used in the validation engine to avoid N+1 queries.
     */
    @Query("SELECT cs FROM ClassSession cs " +
           "LEFT JOIN FETCH cs.subject " +
           "LEFT JOIN FETCH cs.teacher " +
           "LEFT JOIN FETCH cs.year y " +
           "LEFT JOIN FETCH y.branch " +
           "WHERE cs.id = :sessionId")
    Optional<ClassSession> findByIdWithDetails(@Param("sessionId") UUID sessionId);

    /**
     * Find sessions scheduled within a time window (for dashboard).
     */
    @Query("SELECT cs FROM ClassSession cs " +
           "WHERE cs.scheduledAt BETWEEN :from AND :to " +
           "ORDER BY cs.scheduledAt")
    List<ClassSession> findByScheduledAtBetween(
        @Param("from") LocalDateTime from,
        @Param("to")   LocalDateTime to
    );

    /** Teacher's sessions today. */
    @Query("SELECT cs FROM ClassSession cs " +
           "WHERE cs.teacher.id = :teacherId " +
           "AND cs.scheduledAt >= :startOfDay AND cs.scheduledAt < :endOfDay " +
           "ORDER BY cs.scheduledAt")
    List<ClassSession> findTodaysSessionsByTeacher(
        @Param("teacherId")  UUID teacherId,
        @Param("startOfDay") LocalDateTime startOfDay,
        @Param("endOfDay")   LocalDateTime endOfDay
    );
    /**
     * Targeted UPDATE — only changes current_token, never touches status or other fields.
     *
     * Using a full entity save() in rotateAndBroadcast() is unsafe because the
     * scheduler holds a detached entity snapshot that may have a stale status.
     * Merging it can silently overwrite a COMPLETED session back to ACTIVE.
     * This JPQL UPDATE avoids that entirely.
     */
    @Modifying
    @Transactional
    @Query("UPDATE ClassSession cs SET cs.currentToken = :token WHERE cs.id = :id")
    void updateCurrentToken(@Param("id") UUID id, @Param("token") String token);
}
