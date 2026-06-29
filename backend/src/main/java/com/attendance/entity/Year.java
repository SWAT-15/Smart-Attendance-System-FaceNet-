package com.attendance.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
 * Represents an academic year within a branch.
 * e.g. "1st Year" (yearNumber = 1), "Final Year" (yearNumber = 4)
 */
@Entity
@Table(
    name = "years",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_year_branch_number",
            columnNames = {"branch_id", "year_number"}
        )
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"branch", "subjects", "students", "classSessions"})
public class Year {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** Academic year number (1–6 to accommodate medical). */
    @Column(name = "year_number", nullable = false)
    @Min(value = 1, message = "Year number must be at least 1")
    @Max(value = 6, message = "Year number must not exceed 6")
    private Short yearNumber;

    /** Display label. e.g. "1st Year", "2nd Year", "Final Year" */
    @Column(nullable = false, length = 50)
    private String label;

    // ── Relationships ───────────────────────────────────────────
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    @JsonIgnoreProperties("years")
    private Branch branch;

    @OneToMany(
        mappedBy = "year",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @JsonIgnore
    private List<Subject> subjects = new ArrayList<>();

    @OneToMany(
        mappedBy = "year",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @JsonIgnore
    private List<Student> students = new ArrayList<>();

    @OneToMany(
        mappedBy = "year",
        fetch = FetchType.LAZY
    )
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
