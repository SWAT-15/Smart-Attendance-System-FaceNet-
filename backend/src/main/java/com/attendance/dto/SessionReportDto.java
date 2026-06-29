package com.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Complete report for a single class session. */
@Data
@Builder
public class SessionReportDto {
    private UUID sessionId;
    private String sessionTitle;
    private String subjectName;
    private String subjectCode;
    private String teacherName;
    private LocalDateTime scheduledAt;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private String status;              // SCHEDULED / ACTIVE / ENDED

    private int totalStudents;
    private int presentCount;
    private int absentCount;
    private double attendancePercentage;

    private List<AttendanceSheetEntryDto> entries;
}
