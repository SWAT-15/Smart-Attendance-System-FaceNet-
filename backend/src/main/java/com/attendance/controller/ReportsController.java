package com.attendance.controller;

import com.attendance.dto.SessionReportDto;
import com.attendance.dto.SubjectAttendanceDto;
import com.attendance.service.ReportsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reports & Analytics REST Controller — Phase 7
 *
 * Base URL: /api/reports
 *
 * Endpoints:
 *  GET  /reports/student/me          — Student: my subject attendance summary
 *  GET  /reports/session/{id}        — Teacher/Admin: full session attendance sheet
 *  GET  /reports/session/{id}/export — Teacher/Admin: download session CSV
 *  GET  /reports/teacher/sessions    — Teacher: all my session summaries
 *  GET  /reports/admin/overview      — Admin: system-wide stats
 *  GET  /reports/admin/student/{id}  — Admin: specific student's subject report
 */
@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Reports", description = "Attendance analytics and session reports")
public class ReportsController {

    private final ReportsService reportsService;

    // ── Student: own report ────────────────────────────────────────

    @GetMapping("/student/me")
    @PreAuthorize("hasAnyRole('STUDENT')")
    @Operation(summary = "Get the logged-in student's per-subject attendance summary")
    public ResponseEntity<List<SubjectAttendanceDto>> getMyReport(Principal principal) {
        return ResponseEntity.ok(reportsService.getStudentReport(principal.getName()));
    }

    // ── Session report (Teacher + Admin) ──────────────────────────

    @GetMapping("/session/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Get the full attendance sheet for a session")
    public ResponseEntity<SessionReportDto> getSessionReport(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(reportsService.getSessionReport(sessionId));
    }

    @GetMapping("/session/{sessionId}/export")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Download session attendance sheet as CSV")
    public ResponseEntity<byte[]> exportSessionCsv(@PathVariable UUID sessionId) {
        String csv = reportsService.exportSessionCsv(sessionId);
        String filename = "attendance-" + sessionId + "-" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    // ── Teacher: all my sessions ───────────────────────────────────

    @GetMapping("/teacher/sessions")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Get all session summaries for the logged-in teacher")
    public ResponseEntity<List<SessionReportDto>> getTeacherSessions(Principal principal) {
        return ResponseEntity.ok(reportsService.getTeacherSessionReports(principal.getName()));
    }

    // ── Admin endpoints ────────────────────────────────────────────

    @GetMapping("/admin/overview")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin system-wide attendance overview and branch stats")
    public ResponseEntity<Map<String, Object>> getAdminOverview() {
        return ResponseEntity.ok(reportsService.getAdminOverview());
    }

    @GetMapping("/admin/student/{studentId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: get a specific student's per-subject attendance report")
    public ResponseEntity<List<SubjectAttendanceDto>> getStudentReport(@PathVariable UUID studentId) {
        return ResponseEntity.ok(reportsService.getStudentReportById(studentId));
    }
}
