package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * AttendanceRecord — the definitive record of a student's attendance.
 *
 * Created ONLY after ALL three checks pass:
 *   1. QR token is valid and not expired (Redis check)
 *   2. Liveness detection passed (client-side, attested by flag)
 *   3. FaceNet embedding matches the student's registered face
 *
 * The UNIQUE constraint (student_id, session_id) prevents duplicates.
 *
 * Face similarity score and liveness flag are stored for audit
 * and to allow threshold tuning without re-processing.
 */
@Entity
@Table(
    name = "attendance_records",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_attendance_student_session",
            columnNames = {"student_id", "session_id"}
        )
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"student", "session", "overriddenBy"})
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "attend_status")
    @Builder.Default
    private AttendanceStatus status = AttendanceStatus.PRESENT;

    /** Exact timestamp when the attendance was recorded. */
    @Column(name = "marked_at", nullable = false)
    @Builder.Default
    private LocalDateTime markedAt = LocalDateTime.now();

    // ── Face Match Quality ───────────────────────────────────────
    /**
     * Cosine similarity score between the submitted face and the
     * registered face embedding. Range: 0.0 – 1.0
     * Threshold for PRESENT: >= 0.80 (configurable)
     */
    @Column(name = "face_similarity", precision = 5, scale = 4)
    private BigDecimal faceSimilarity;

    /** Whether the client-side liveness check was passed. */
    @Column(name = "liveness_passed", nullable = false)
    @Builder.Default
    private Boolean livenessPassed = false;

    // ── QR Audit ─────────────────────────────────────────────────
    /** The exact QR token used to record this attendance. */
    @Column(name = "qr_token_used", length = 255)
    private String qrTokenUsed;

    /**
     * How this record was created:
     *  "QR_FACE_LIVENESS" — student scanned QR + passed face + liveness
     *  "AUTO_ABSENT"      — auto-marked when session ended without a scan
     *  "ADMIN_OVERRIDE"   — manually set by admin
     */
    @Column(name = "verification_method", length = 50)
    private String verificationMethod;

    /** Student's IP address for fraud detection. */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /** Browser/device User-Agent string. */
    @Column(name = "device_info", columnDefinition = "TEXT")
    private String deviceInfo;

    // ── Admin Override ───────────────────────────────────────────
    /**
     * If an Admin overrides attendance (ABSENT → PRESENT or vice versa),
     * the admin's user ID and reason are recorded here.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "overridden_by")
    private User overriddenBy;

    @Column(name = "override_reason", columnDefinition = "TEXT")
    private String overrideReason;

    // ── Relationships ─────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private ClassSession session;

    // ── Audit Timestamps ──────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
