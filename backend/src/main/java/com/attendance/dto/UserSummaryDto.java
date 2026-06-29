package com.attendance.dto;

import com.attendance.entity.UserRole;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

/** Read-only DTO returned when listing users — never exposes passwordHash. */
@Data
public class UserSummaryDto {
    private UUID id;
    private String email;
    private String fullName;
    private String profilePicture;
    private UserRole role;
    private Boolean isEnabled;
    private LocalDateTime createdAt;

    // Student-specific fields (null for Teacher/Admin)
    private String rollNumber;
    private String yearLabel;
    private String branchName;
    private Boolean faceEnrolled;

    // Teacher-specific fields
    private String employeeId;
    private String department;
}
