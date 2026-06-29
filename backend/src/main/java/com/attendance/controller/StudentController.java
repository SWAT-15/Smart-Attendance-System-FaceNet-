package com.attendance.controller;

import com.attendance.dto.AttendanceSubmitDto;
import com.attendance.entity.AttendanceRecord;
import com.attendance.entity.Student;
import com.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Student-facing REST endpoints.
 * All require ROLE_STUDENT.
 *
 * Base URL: /api/student
 *
 * Key endpoint: POST /api/student/attendance/submit
 *  Runs the 6-step security pipeline:
 *  session active → no duplicate → QR token valid → liveness → face enrolled → FaceNet match
 */
@RestController
@RequestMapping("/student")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Student", description = "Student portal and attendance submission")
public class StudentController {

    private final AttendanceService attendanceService;

    // ── Attendance Submission ──────────────────────────────────────

    /**
     * Primary attendance submission endpoint.
     *
     * Request body (JSON):
     *  {
     *    "sessionId":     "uuid-of-active-class-session",
     *    "qrToken":       "token-decoded-from-qr-image",
     *    "imageFrame":    "data:image/jpeg;base64,/9j/4AAQSk...",
     *    "livenessPassed": true,
     *    "ipAddress":     "optional — auto-detected if omitted",
     *    "deviceInfo":    "optional — auto-detected from User-Agent"
     *  }
     */
    @PostMapping("/attendance/submit")
    @Operation(summary = "Submit attendance via QR scan + liveness + face recognition")
    public ResponseEntity<?> submitAttendance(
            @Valid @RequestBody AttendanceSubmitDto dto,
            Principal principal,
            HttpServletRequest httpRequest) {
        try {
            Map<String, Object> result = attendanceService.submitAttendance(
                    dto,
                    principal.getName(),
                    httpRequest.getRemoteAddr(),
                    httpRequest.getHeader("User-Agent")
            );
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "FAILED",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Attendance submission error for {}: {}", principal.getName(), e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "An internal error occurred. Please try again."
            ));
        }
    }

    // ── Student Profile ────────────────────────────────────────────

    @GetMapping("/profile")
    @Operation(summary = "Get the logged-in student's profile")
    public ResponseEntity<Student> getProfile(Principal principal) {
        return ResponseEntity.ok(attendanceService.getStudentProfile(principal.getName()));
    }

    // ── Attendance History ─────────────────────────────────────────

    @GetMapping("/attendance/history")
    @Operation(summary = "Get the student's full attendance history")
    public ResponseEntity<List<AttendanceRecord>> getAttendanceHistory(Principal principal) {
        return ResponseEntity.ok(attendanceService.getAttendanceHistory(principal.getName()));
    }
}
