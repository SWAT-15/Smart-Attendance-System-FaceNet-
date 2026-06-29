package com.attendance.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

/** Request body to create a new ClassSession. */
@Data
public class CreateSessionRequest {
    private String title;
    private String room;
    private UUID subjectId;
    private UUID yearId;
    private LocalDateTime scheduledAt;
}
