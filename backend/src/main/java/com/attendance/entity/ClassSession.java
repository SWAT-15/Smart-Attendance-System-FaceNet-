package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * ClassSession — a specific lecture instance.
 *
 * This is the heart of the QR attendance system.
 * When a teacher STARTS a session, the backend:
 *   1. Sets status → ACTIVE
 *   2. Starts generating rotating QR tokens (stored in Redis with TTL)
 *   3. Broadcasts new tokens to the teacher's projector view via WebSocket
 *
 * When the session ENDS:
 *   1. Sets status → COMPLETED
 *   2. Students with no AttendanceRecord get auto-marked ABSENT
 */
@Entity
@Table(name = "class_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"subject", "teacher", "year", "attendanceRecords"})
public class ClassSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** Descriptive title. e.g. "Lecture 12 – Binary Trees" */
    @Column(nullable = false, length = 255)
    private String title;

    /** Physical room or online link. e.g. "Lab-3", "https://meet.google.com/..." */
    @Column(length = 100)
    private String room;

    /** When the session is scheduled (may differ from actual start). */
    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    /** Actual start time (set when teacher clicks "Start Session"). */
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    /** Actual end time (set when teacher clicks "End Session"). */
    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "session_status")
    @Builder.Default
    private SessionStatus status = SessionStatus.SCHEDULED;

    /**
     * The most recently generated QR token (stored here for audit).
     * The LIVE token with TTL lives in Redis; this is only for reference.
     * Key pattern in Redis: "qr:session:{sessionId}" → token
     */
    @Column(name = "current_token", length = 255)
    private String currentToken;

    // ── Relationships ───────────────────────────────────────────
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    /**
     * The year group this session is for.
     * All students in this year can attend.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "year_id", nullable = false)
    private Year year;

    @OneToMany(
        mappedBy = "session",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @JsonIgnore
    private List<AttendanceRecord> attendanceRecords = new ArrayList<>();

    // ── Audit Timestamps ────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ── Domain Logic ─────────────────────────────────────────────
    public boolean isActive() {
        return SessionStatus.ACTIVE.equals(this.status);
    }

    public void start() {
        this.status = SessionStatus.ACTIVE;
        this.startedAt = LocalDateTime.now();
    }

    public void end() {
        this.status = SessionStatus.COMPLETED;
        this.endedAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = SessionStatus.CANCELLED;
        this.endedAt = LocalDateTime.now();
    }
}
