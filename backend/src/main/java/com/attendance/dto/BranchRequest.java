package com.attendance.dto;

import lombok.Data;
import java.util.UUID;

/** Request body for creating a Branch. */
@Data
public class BranchRequest {
    private String name;
    private String code;
    private String description;
}
