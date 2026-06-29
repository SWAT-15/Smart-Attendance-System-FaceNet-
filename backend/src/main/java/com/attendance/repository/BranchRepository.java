package com.attendance.repository;

import com.attendance.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Branch entity.
 */
@Repository
public interface BranchRepository extends JpaRepository<Branch, UUID> {

    Optional<Branch> findByCode(String code);

    Optional<Branch> findByName(String name);

    boolean existsByCode(String code);

    boolean existsByName(String name);

    /**
     * Load branch with its years eagerly (avoids N+1 in admin list view).
     */
    @Query("SELECT b FROM Branch b LEFT JOIN FETCH b.years ORDER BY b.name")
    List<Branch> findAllWithYears();
}
