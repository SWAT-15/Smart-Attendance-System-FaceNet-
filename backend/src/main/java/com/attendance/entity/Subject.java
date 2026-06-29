package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A Subject / course taught within a specific branch year.
 * e.g. "Data Structures" (CS301) in CS 3rd Year.
 */
@Entity
@Table(
    name = "subjects",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_subject_code", columnNames = "code")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"year", "teachers", "classSessions"})
public class Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    /** Course code. e.g. "CS301", "ME204" */
    @Column(nullable = false, length = 30)
    private String code;

    @Column(columnDefinition = "SMALLINT DEFAULT 3")
    private Short credits;

    // ── Relationships ───────────────────────────────────────────
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "year_id", nullable = false)
    @JsonIgnoreProperties("subjects")
    private Year year;

    /**
     * Teachers who teach this subject (Many-to-Many via teacher_subjects join table).
     * Ownership of the join table lives on the Teacher side.
     */
    @ManyToMany(mappedBy = "subjects", fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<Teacher> teachers = new ArrayList<>();

    @OneToMany(mappedBy = "subject", fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<ClassSession> classSessions = new ArrayList<>();

    // ── Audit Timestamps ────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
