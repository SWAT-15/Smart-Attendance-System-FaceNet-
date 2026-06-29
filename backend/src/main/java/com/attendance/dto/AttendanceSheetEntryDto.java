package com.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** One row in a session attendance sheet. */
@Data
@Builder
public class AttendanceSheetEntryDto {
    private UUID studentId;
    private String fullName;
    private String rollNumber;
    private String branchName;
    private String yearLabel;
    private String status;               // PRESENT / ABSENT / LATE
    private LocalDateTime markedAt;
    private BigDecimal faceSimilarity;   // null for ABSENT
    private boolean livenessPassed;
    private String verificationMethod;
}
