package com.attendance.repository;

import com.attendance.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Subject entity.
 */
@Repository
public interface SubjectRepository extends JpaRepository<Subject, UUID> {

    Optional<Subject> findByCode(String code);

    boolean existsByCode(String code);

    List<Subject> findByYearId(UUID yearId);

    /**
     * Find subjects assigned to a teacher (via teacher_subjects join table).
     */
    @Query("SELECT s FROM Subject s JOIN s.teachers t WHERE t.id = :teacherId")
    List<Subject> findByTeacherId(@Param("teacherId") UUID teacherId);

    /**
     * Load subject with its year and branch in one query (for validation).
     */
    @Query("SELECT s FROM Subject s LEFT JOIN FETCH s.year y LEFT JOIN FETCH y.branch WHERE s.id = :subjectId")
    Optional<Subject> findByIdWithYearAndBranch(@Param("subjectId") UUID subjectId);

    @Override
    @Query("SELECT s FROM Subject s LEFT JOIN FETCH s.year y LEFT JOIN FETCH y.branch")
    List<Subject> findAll();
}
