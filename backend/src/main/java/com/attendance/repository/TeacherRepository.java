package com.attendance.repository;

import com.attendance.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Teacher entity.
 */
@Repository
public interface TeacherRepository extends JpaRepository<Teacher, UUID> {

    Optional<Teacher> findByEmployeeId(String employeeId);

    boolean existsByEmployeeId(String employeeId);

    /** Find teacher by email (email field lives in the parent User table). */
    Optional<Teacher> findByEmail(String email);

    List<Teacher> findByDepartment(String department);

    /**
     * Eagerly load teacher with subjects by email — used in TeacherController.
     */
    @Query("SELECT t FROM Teacher t LEFT JOIN FETCH t.subjects WHERE t.email = :email")
    Optional<Teacher> findByEmailWithSubjects(@Param("email") String email);

    /**
     * Find all teachers assigned to a specific subject.
     * Traverses the many-to-many join table.
     */
    @Query("SELECT t FROM Teacher t JOIN t.subjects s WHERE s.id = :subjectId")
    List<Teacher> findBySubjectId(@Param("subjectId") UUID subjectId);

    /**
     * Load teacher with their subjects eagerly (avoids N+1 in subject listing).
     */
    @Query("SELECT t FROM Teacher t LEFT JOIN FETCH t.subjects WHERE t.id = :teacherId")
    Optional<Teacher> findByIdWithSubjects(@Param("teacherId") UUID teacherId);
}
