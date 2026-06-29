package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * QrAuditLog — immutable security log for ALL QR scan attempts.
 *
 * Written for EVERY scan attempt, whether successful or not.
 * This provides a tamper-evident audit trail for:
 *   - Identifying replay attacks (same token used twice)
 *   - Detecting proxy / impersonation attempts (multiple IPs)
 *   - Forensic investigation of attendance disputes
 *
 * Uses SEQUENCE-based Long ID (not UUID) for high-throughput inserts.
 * This table is append-only — no updates, no deletes.
 */
@Entity
@Table(name = "qr_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class QrAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "qr_audit_seq")
    @SequenceGenerator(
        name            = "qr_audit_seq",
        sequenceName    = "qr_audit_log_id_seq",
        allocationSize  = 1   // matches database sequence increment size of 1
    )
    @EqualsAndHashCode.Include
    private Long id;

    /** The QR token that was scanned (for matching against Redis audit). */
    @Column(name = "qr_token", nullable = false, length = 255)
    private String qrToken;

    /** Timestamp of the scan attempt. */
    @Column(name = "attempt_at", nullable = false)
    @Builder.Default
    private LocalDateTime attemptAt = LocalDateTime.now();

    /** True = all checks passed and attendance was recorded. */
    @Column(nullable = false)
    private Boolean success;

    /**
     * Reason code if the attempt failed.
     * Values: TOKEN_EXPIRED | TOKEN_NOT_FOUND | REPLAY_ATTACK |
     *         FACE_MISMATCH | LIVENESS_FAILED | STUDENT_NOT_FOUND |
     *         SESSION_NOT_ACTIVE | ALREADY_RECORDED
     */
    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    /** Student's IP address (IPv4 or IPv6). */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /** Browser/device User-Agent string. */
    @Column(name = "device_info", columnDefinition = "TEXT")
    private String deviceInfo;

    // ── Relationships (nullable — may not have context on failure) ──
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private ClassSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;
}
