package com.attendance.dto;

import lombok.Data;
import java.util.UUID;

/** Request body for creating a Subject. */
@Data
public class SubjectRequest {
    private String name;
    private String code;
    private Short credits;
    private UUID yearId;
}
