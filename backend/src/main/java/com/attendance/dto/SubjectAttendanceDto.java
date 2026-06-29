package com.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/** Attendance statistics for a student in a single subject. */
@Data
@Builder
public class SubjectAttendanceDto {
    private UUID subjectId;
    private String subjectName;
    private String subjectCode;

    private int totalSessions;
    private int presentCount;
    private int absentCount;
    private double percentage;          // 0.0 – 100.0
    private boolean belowThreshold;     // true if percentage < 75
}
