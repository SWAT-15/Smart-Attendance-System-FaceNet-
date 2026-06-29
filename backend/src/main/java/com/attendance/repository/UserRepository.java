package com.attendance.repository;

import com.attendance.entity.User;
import com.attendance.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for the User entity.
 * Provides queries needed by Spring Security and admin APIs.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /** Used by Spring Security UserDetailsService to load by email. */
    Optional<User> findByEmail(String email);

    /** Used during Google OAuth2 callback to link returning users. */
    Optional<User> findByGoogleSub(String googleSub);

    boolean existsByEmail(String email);

    List<User> findByRole(UserRole role);

    /** Find enabled users by role (e.g. all active teachers). */
    List<User> findByRoleAndIsEnabledTrue(UserRole role);

    /** Check if a user with this email has the given role. */
    @Query("SELECT CASE WHEN COUNT(u) > 0 THEN TRUE ELSE FALSE END " +
           "FROM User u WHERE u.email = :email AND u.role = :role")
    boolean existsByEmailAndRole(@Param("email") String email,
                                 @Param("role")  UserRole role);
}
