package com.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AttendanceSubmitDto {

    @NotBlank(message = "Session ID is required")
    private String sessionId;

    @NotBlank(message = "QR Token is required")
    private String qrToken;

    /** Base64 encoded web camera frame */
    @NotBlank(message = "Image frame is required")
    private String imageFrame;

    private boolean livenessPassed;
    private String ipAddress;
    private String deviceInfo;
}
