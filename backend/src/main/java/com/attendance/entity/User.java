package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Base User entity using Single-Table Inheritance (STI).
 *
 * All three actor types (Admin, Teacher, Student) are stored in the
 * 'users' table, discriminated by the 'role' column.
 *
 * Admin users have NO sub-table — everything they need is here.
 * Teacher and Student have joined sub-tables (see Teacher.java, Student.java).
 *
 * This approach gives us:
 *  - A single login query regardless of role.
 *  - Clean Spring Security UserDetails loading.
 *  - Minimal table joins for auth hot-path.
 */
@Entity
@Table(
    name = "users",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_email",  columnNames = "email"),
        @UniqueConstraint(name = "uq_google_sub",  columnNames = "google_sub")
    }
)
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "role", discriminatorType = DiscriminatorType.STRING)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    /**
     * Role is stored as the discriminator column AND as a regular
     * mapped column so we can query it directly without casting.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false,
            insertable = false, updatable = false)   // managed by JPA discriminator
    private UserRole role;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    /** URL of the Google profile picture (populated on first OAuth login). */
    @Column(name = "profile_picture", columnDefinition = "TEXT")
    private String profilePicture;

    /**
     * Google OAuth2 'sub' claim — the stable unique identifier from Google.
     * Used to link returning OAuth users without relying on mutable email.
     */
    @Column(name = "google_sub", length = 255, unique = true)
    private String googleSub;

    /** BCrypt-hashed password. NULL for pure OAuth users. */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "is_enabled", nullable = false)
    @Builder.Default
    private Boolean isEnabled = true;

    @Column(name = "is_locked", nullable = false)
    @Builder.Default
    private Boolean isLocked = false;

    // ── Audit ────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ── Convenience ──────────────────────────────────────────────
    public boolean isAdmin() {
        return UserRole.ADMIN.equals(this.role);
    }

    public boolean isTeacher() {
        return UserRole.TEACHER.equals(this.role);
    }

    public boolean isStudent() {
        return UserRole.STUDENT.equals(this.role);
    }
}
