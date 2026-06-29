package com.attendance.controller;

import com.attendance.dto.FaceEnrollRequest;
import com.attendance.entity.Student;
import com.attendance.service.FaceEnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

/**
 * Face Enrollment endpoints.
 *
 * Admin path:   POST /api/admin/students/{studentId}/enroll-face
 *               DELETE /api/admin/students/{studentId}/enroll-face  (reset)
 *
 * Student path: POST /api/student/enroll-face   (self-enroll)
 *
 * Both paths call FaceNetClient → Python /embed → store 512-float embedding in Supabase.
 */
@RestController
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Face Enrollment", description = "Endpoints for enrolling and resetting student face embeddings")
public class FaceEnrollmentController {

    private final FaceEnrollmentService faceEnrollmentService;

    // ── Admin: Enroll a student ────────────────────────────────────

    /**
     * Admin enrolls a specific student's face.
     *
     * Request body:
     *  {
     *    "imageB64": "data:image/jpeg;base64,/9j/4AAQSk...",
     *    "imagePath": "face-references/uuid.jpg"   ← optional
     *  }
     */
    @PostMapping("/admin/students/{studentId}/enroll-face")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: enroll a student's face embedding")
    public ResponseEntity<?> adminEnroll(
            @PathVariable UUID studentId,
            @RequestBody FaceEnrollRequest req) {
        try {
            Student student = faceEnrollmentService.adminEnrollStudent(studentId, req);
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Face enrolled successfully for " + student.getFullName(),
                "studentId", studentId.toString(),
                "faceEnrolled", true,
                "enrolledAt", student.getEnrolledAt().toString()
            ));
        } catch (IllegalArgumentException | java.util.NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "FAILED",
                "message", e.getMessage()
            ));
        } catch (RuntimeException e) {
            log.error("Face enrollment failed for student {}: {}", studentId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", e.getMessage()
            ));
        }
    }

    // ── Admin: Reset a student's enrollment ───────────────────────

    @DeleteMapping("/admin/students/{studentId}/enroll-face")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: reset (clear) a student's face enrollment")
    public ResponseEntity<?> resetEnrollment(@PathVariable UUID studentId) {
        faceEnrollmentService.resetEnrollment(studentId);
        return ResponseEntity.ok(Map.of(
            "status", "SUCCESS",
            "message", "Face enrollment cleared. Student must re-enroll before attending."
        ));
    }

    // ── Student: Self-enroll ──────────────────────────────────────

    /**
     * Allows a student to self-enroll their face from the /student/enroll page.
     *
     * The student must be authenticated (JWT). Their enrollment is tied to their
     * own account — they cannot enroll for another student.
     */
    @PostMapping("/student/enroll-face")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Student: self-enroll face via webcam capture")
    public ResponseEntity<?> selfEnroll(
            @RequestBody FaceEnrollRequest req,
            Principal principal) {
        try {
            Student student = faceEnrollmentService.selfEnroll(principal.getName(), req);
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Face enrolled! You can now attend classes via QR scan.",
                "faceEnrolled", true,
                "enrolledAt", student.getEnrolledAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "FAILED",
                "message", e.getMessage()
            ));
        } catch (RuntimeException e) {
            log.error("Self-enrollment failed for {}: {}", principal.getName(), e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", e.getMessage()
            ));
        }
    }
}
