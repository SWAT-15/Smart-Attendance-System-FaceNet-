package com.attendance.repository;

import com.attendance.entity.AttendanceRecord;
import com.attendance.entity.AttendanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for AttendanceRecord entity.
 * Provides queries for attendance reporting, duplicate prevention,
 * and admin override workflows.
 */
@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, UUID> {

    /**
     * Check for duplicate before saving (enforces one record per student per session).
     */
    boolean existsByStudentIdAndSessionId(UUID studentId, UUID sessionId);

    Optional<AttendanceRecord> findByStudentIdAndSessionId(UUID studentId, UUID sessionId);

    /** All attendance records for a session (teacher/admin report view). */
    List<AttendanceRecord> findBySessionId(UUID sessionId);

    /** All attendance records for a student (student's own history). */
    List<AttendanceRecord> findByStudentIdOrderByMarkedAtDesc(UUID studentId);

    /**
     * Student's attendance history with all lazy associations eagerly loaded in one query.
     * JOIN FETCH prevents LazyInitializationException when Jackson serializes
     * AttendanceRecord entities after the transaction has closed.
     */
    @Query("SELECT ar FROM AttendanceRecord ar " +
           "JOIN FETCH ar.student s " +
           "JOIN FETCH ar.session cs " +
           "JOIN FETCH cs.subject " +
           "JOIN FETCH cs.teacher " +
           "JOIN FETCH cs.year y " +
           "JOIN FETCH y.branch " +
           "LEFT JOIN FETCH ar.overriddenBy " +
           "WHERE s.id = :studentId " +
           "ORDER BY ar.markedAt DESC")
    List<AttendanceRecord> findHistoryByStudentId(@Param("studentId") UUID studentId);

    /** Records by status for a session (e.g., all PRESENT in session X). */
    List<AttendanceRecord> findBySessionIdAndStatus(UUID sessionId, AttendanceStatus status);

    /**
     * Attendance percentage for a student in a subject.
     * Returns [totalSessions, presentSessions] as an Object[].
     */
    @Query("SELECT COUNT(ar), " +
           "       SUM(CASE WHEN ar.status = 'PRESENT' OR ar.status = 'LATE' THEN 1 ELSE 0 END) " +
           "FROM AttendanceRecord ar " +
           "JOIN ar.session cs " +
           "WHERE ar.student.id = :studentId " +
           "AND cs.subject.id = :subjectId")
    List<Object[]> getAttendanceStatsForStudentAndSubject(
        @Param("studentId")  UUID studentId,
        @Param("subjectId")  UUID subjectId
    );

    /**
     * Summary count per session — how many students are PRESENT.
     * Used in admin dashboard overview.
     */
    @Query("SELECT ar.session.id, COUNT(ar) " +
           "FROM AttendanceRecord ar " +
           "WHERE ar.status = 'PRESENT' " +
           "GROUP BY ar.session.id")
    List<Object[]> countPresentPerSession();

    /** Count all records by status — for admin overview. */
    long countByStatus(AttendanceStatus status);

    /**
     * Fetch records with student details in one query (avoids N+1 in reports).
     */
    @Query("SELECT ar FROM AttendanceRecord ar " +
           "LEFT JOIN FETCH ar.student s " +
           "LEFT JOIN FETCH s.year y " +
           "LEFT JOIN FETCH y.branch " +
           "WHERE ar.session.id = :sessionId " +
           "ORDER BY s.fullName")
    List<AttendanceRecord> findBySessionIdWithStudentDetails(@Param("sessionId") UUID sessionId);

    /**
     * Find records in a date range (for monthly/weekly reports).
     */
    @Query("SELECT ar FROM AttendanceRecord ar " +
           "WHERE ar.student.id = :studentId " +
           "AND ar.markedAt BETWEEN :from AND :to " +
           "ORDER BY ar.markedAt")
    List<AttendanceRecord> findByStudentAndDateRange(
        @Param("studentId") UUID studentId,
        @Param("from")      LocalDateTime from,
        @Param("to")        LocalDateTime to
    );
}
