package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Student entity — extends User via JOINED inheritance.
 *
 * The 'students' table stores only student-specific columns.
 * The primary key (user_id) is a foreign key to 'users.id'.
 *
 * Key feature: stores the 512-dimensional FaceNet embedding
 * as a PostgreSQL vector column (pgvector extension).
 * JPA maps it as a float array; pgvector handles cosine distance queries.
 */
@Entity
@Table(name = "students")
@PrimaryKeyJoinColumn(name = "user_id")
@DiscriminatorValue("STUDENT")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, exclude = {"year", "attendanceRecords"})
public class Student extends User {

    /** Institutional roll number. e.g. "CSE2021001" */
    @Column(name = "roll_number", nullable = false, unique = true, length = 50)
    private String rollNumber;

    // ── Relationships ───────────────────────────────────────────
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "year_id", nullable = false)
    @JsonIgnoreProperties("students")
    private Year year;

    @OneToMany(mappedBy = "student", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<AttendanceRecord> attendanceRecords = new ArrayList<>();

    // ── Face Recognition ────────────────────────────────────────
    /**
     * 512-dimensional FaceNet embedding stored as a PostgreSQL vector.
     *
     * JPA does not natively understand pgvector, so we store it as a
     * binary blob and use a custom converter, OR we use the
     * hibernate-types-60 library (see FaceEmbeddingConverter.java).
     *
     * The column type in DB is: vector(512)
     * We map it here as float[] and rely on our custom converter.
     */
    @Column(name = "face_embedding", columnDefinition = "vector(512)")
    @org.hibernate.annotations.ColumnTransformer(write = "CAST(? AS vector)")
    @Convert(converter = com.attendance.config.FaceEmbeddingConverter.class)
    private float[] faceEmbedding;

    /** S3 key or local path to the reference face image. */
    @Column(name = "face_image_path", columnDefinition = "TEXT")
    private String faceImagePath;

    /** True once the student has completed face enrollment. */
    @Column(name = "face_enrolled", nullable = false)
    @Builder.Default
    private Boolean faceEnrolled = false;

    @Column(name = "enrolled_at")
    private LocalDateTime enrolledAt;

    // ── Computed ─────────────────────────────────────────────────
    /**
     * Returns the branch this student belongs to (via year → branch).
     * Convenience traversal, not a DB column.
     */
    @Transient
    public Branch getBranch() {
        return (year != null) ? year.getBranch() : null;
    }
}
