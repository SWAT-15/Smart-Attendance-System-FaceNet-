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
 * Represents an academic branch / department.
 * e.g. "Computer Science", "Mechanical Engineering"
 */
@Entity
@Table(
    name = "branches",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_branch_name", columnNames = "name"),
        @UniqueConstraint(name = "uq_branch_code", columnNames = "code")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"years"})
public class Branch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** Full branch name. e.g. "Computer Science Engineering" */
    @Column(nullable = false, length = 100)
    private String name;

    /** Short code. e.g. "CSE", "ME", "EC" */
    @Column(nullable = false, length = 20)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    // ── Relationships ───────────────────────────────────────────
    /**
     * A branch can have multiple academic years.
     * Cascade: deleting a branch also deletes its year records.
     */
    @OneToMany(
        mappedBy = "branch",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @JsonIgnore
    private List<Year> years = new ArrayList<>();

    // ── Audit Timestamps ────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ── Convenience helpers ─────────────────────────────────────
    public void addYear(Year year) {
        years.add(year);
        year.setBranch(this);
    }

    public void removeYear(Year year) {
        years.remove(year);
        year.setBranch(null);
    }
}
