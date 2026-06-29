package com.attendance.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

/** Lightweight session summary sent over WebSocket and REST. */
@Data
@Builder
public class SessionSummaryDto {
    private UUID id;
    private String title;
    private String room;
    private String status;
    private String subjectName;
    private String subjectCode;
    private String yearLabel;
    private String branchName;
    private LocalDateTime scheduledAt;
    private LocalDateTime startedAt;
    private int presentCount;
}
