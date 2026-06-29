package com.attendance.repository;

import com.attendance.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Student entity.
 * Includes face-enrollment and year-scoped queries.
 */
@Repository
public interface StudentRepository extends JpaRepository<Student, UUID> {

    Optional<Student> findByRollNumber(String rollNumber);

    boolean existsByRollNumber(String rollNumber);

    /** Find student by email (email lives in parent User table via JOINED inheritance). */
    Optional<Student> findByEmail(String email);

    /** All students in a specific academic year. */
    List<Student> findByYearId(UUID yearId);

    /** All enrolled students in a year (for attendance generation). */
    List<Student> findByYearIdAndFaceEnrolledTrue(UUID yearId);

    /** Students in a branch — traverses year → branch. */
    @Query("SELECT s FROM Student s WHERE s.year.branch.id = :branchId")
    List<Student> findByBranchId(@Param("branchId") UUID branchId);

    /** Students pending face enrollment (for admin dashboard). */
    @Query("SELECT s FROM Student s WHERE s.faceEnrolled = false AND s.isEnabled = true")
    List<Student> findStudentsPendingEnrollment();

    /**
     * Fetch a student along with their year and branch in one query.
     * Avoids N+1 for list views.
     */
    @Query("SELECT s FROM Student s " +
           "LEFT JOIN FETCH s.year y " +
           "LEFT JOIN FETCH y.branch " +
           "WHERE s.id = :studentId")
    Optional<Student> findByIdWithYearAndBranch(@Param("studentId") UUID studentId);

    /** Count students with face enrolled — for admin overview. */
    long countByFaceEnrolledTrue();

    /** Count students in a specific year — for branch breakdown. */
    long countByYearId(UUID yearId);

    @Override
    @Query("SELECT s FROM Student s LEFT JOIN FETCH s.year y LEFT JOIN FETCH y.branch")
    List<Student> findAll();
}
