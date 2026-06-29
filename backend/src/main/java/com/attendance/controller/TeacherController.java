package com.attendance.controller;

import com.attendance.dto.CreateSessionRequest;
import com.attendance.dto.SessionSummaryDto;
import com.attendance.entity.ClassSession;
import com.attendance.service.TeacherService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Teacher-only REST controller.
 * All endpoints require ROLE_TEACHER.
 *
 * Base URL: /api/teacher
 *
 * WebSocket topics (STOMP):
 *  Subscribe: /topic/session/{sessionId}/qr     → receives QR_ROTATE events
 *  Subscribe: /topic/session/{sessionId}        → receives SESSION_ENDED events
 *  Subscribe: /topic/session/{sessionId}/feed   → receives ATTENDANCE_MARKED events
 */
@RestController
@RequestMapping("/teacher")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Teacher", description = "Teacher portal endpoints")
public class TeacherController {

    private final TeacherService teacherService;

    // ── Session List ──────────────────────────────────────────────

    @GetMapping("/sessions")
    @Operation(summary = "Get all sessions created by this teacher")
    public ResponseEntity<List<SessionSummaryDto>> getMySessions(Principal principal) {
        return ResponseEntity.ok(teacherService.getMySessions(principal.getName()));
    }

    // ── Session Create ────────────────────────────────────────────

    @PostMapping("/sessions")
    @Operation(summary = "Create a new class session (remains SCHEDULED until started)")
    public ResponseEntity<ClassSession> createSession(
            @RequestBody CreateSessionRequest req,
            Principal principal) {
        ClassSession session = teacherService.createSession(req, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    // ── Session Start ─────────────────────────────────────────────

    @PostMapping("/sessions/{sessionId}/start")
    @Operation(summary = "Start a session — generates the first QR and broadcasts via WebSocket")
    public ResponseEntity<Map<String, Object>> startSession(
            @PathVariable UUID sessionId,
            Principal principal) {
        return ResponseEntity.ok(teacherService.startSession(sessionId, principal.getName()));
    }

    // ── Session End ───────────────────────────────────────────────

    @PostMapping("/sessions/{sessionId}/end")
    @Operation(summary = "End a session — auto-marks absent students and closes attendance")
    public ResponseEntity<Map<String, Object>> endSession(
            @PathVariable UUID sessionId,
            Principal principal) {
        return ResponseEntity.ok(teacherService.endSession(sessionId, principal.getName()));
    }

    // ── QR Token Refresh (WebSocket Fallback) ─────────────────────

    @GetMapping("/sessions/{sessionId}/qr")
    @Operation(summary = "Get the current QR token for a session (HTTP fallback if WebSocket fails)")
    public ResponseEntity<Map<String, Object>> getQrToken(
            @PathVariable UUID sessionId,
            Principal principal) {
        return ResponseEntity.ok(teacherService.getCurrentQrToken(sessionId, principal.getName()));
    }

    // ── Live Attendance Feed ──────────────────────────────────────

    @GetMapping("/sessions/{sessionId}/feed")
    @Operation(summary = "Get current attendance feed (who has been marked present)")
    public ResponseEntity<List<Map<String, Object>>> getAttendanceFeed(
            @PathVariable UUID sessionId,
            Principal principal) {
        return ResponseEntity.ok(teacherService.getAttendanceFeed(sessionId, principal.getName()));
    }
}
