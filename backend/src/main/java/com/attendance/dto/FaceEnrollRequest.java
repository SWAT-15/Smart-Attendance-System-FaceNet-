package com.attendance.dto;

import lombok.Data;

/** Request body for face enrollment: contains the base64 image. */
@Data
public class FaceEnrollRequest {

    /**
     * Base64-encoded JPEG image of the student's face.
     * Can include the data URI prefix: "data:image/jpeg;base64,..."
     * or be a raw base64 string.
     *
     * Requirements:
     *  - Clear frontal face
     *  - Good lighting, no sunglasses/mask
     *  - Single person in frame
     */
    private String imageB64;

    /**
     * Optional: Supabase Storage path where the reference photo is stored.
     * If provided, this is saved as faceImagePath on the Student entity.
     * If omitted, the backend will auto-generate a path.
     */
    private String imagePath;
}
