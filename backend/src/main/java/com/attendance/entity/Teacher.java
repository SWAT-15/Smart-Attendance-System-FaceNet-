package com.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

/**
 * Teacher entity — extends User via JOINED inheritance.
 *
 * The 'teachers' table stores only teacher-specific columns.
 * The primary key (user_id) is a foreign key to 'users.id'.
 *
 * A teacher:
 *  - Has an employee ID issued by the institution.
 *  - Belongs to a department (can differ from Branch).
 *  - Teaches one or more Subjects (Many-to-Many).
 *  - Runs ClassSessions and generates QR codes.
 */
@Entity
@Table(name = "teachers")
@PrimaryKeyJoinColumn(name = "user_id")
@DiscriminatorValue("TEACHER")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, exclude = {"subjects", "classSessions"})
public class Teacher extends User {

    /** Institutional employee ID. e.g. "EMP1042" */
    @Column(name = "employee_id", nullable = false, unique = true, length = 50)
    private String employeeId;

    /** Department name — may differ from branch. e.g. "CS Department" */
    @Column(length = 100)
    private String department;

    // ── Relationships ───────────────────────────────────────────
    /**
     * Subjects assigned to this teacher.
     * Join table: teacher_subjects (teacher_id, subject_id)
     * Teacher owns the join table.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "teacher_subjects",
        joinColumns        = @JoinColumn(name = "teacher_id"),
        inverseJoinColumns = @JoinColumn(name = "subject_id")
    )
    @Builder.Default
    @JsonIgnore
    private List<Subject> subjects = new ArrayList<>();

    @OneToMany(mappedBy = "teacher", fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<ClassSession> classSessions = new ArrayList<>();

    // ── Convenience helpers ─────────────────────────────────────
    public void assignSubject(Subject subject) {
        subjects.add(subject);
        subject.getTeachers().add(this);
    }

    public void removeSubject(Subject subject) {
        subjects.remove(subject);
        subject.getTeachers().remove(this);
    }
}
