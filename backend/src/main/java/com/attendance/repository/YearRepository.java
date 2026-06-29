package com.attendance.repository;

import com.attendance.entity.Year;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Year entity.
 */
@Repository
public interface YearRepository extends JpaRepository<Year, UUID> {

    List<Year> findByBranchId(UUID branchId);

    Optional<Year> findByBranchIdAndYearNumber(UUID branchId, Short yearNumber);

    /**
     * Load a year with its branch and subjects in one query.
     */
    @Query("SELECT y FROM Year y " +
           "LEFT JOIN FETCH y.branch " +
           "LEFT JOIN FETCH y.subjects " +
           "WHERE y.id = :yearId")
    Optional<Year> findByIdWithBranchAndSubjects(@Param("yearId") UUID yearId);

    /** All years ordered by branch name then year number. */
    @Query("SELECT y FROM Year y JOIN FETCH y.branch b ORDER BY b.name, y.yearNumber")
    List<Year> findAllOrderedByBranchAndYear();
}
