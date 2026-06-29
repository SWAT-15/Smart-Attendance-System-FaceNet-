package com.attendance.controller;

import com.attendance.dto.*;
import com.attendance.entity.Branch;
import com.attendance.entity.Subject;
import com.attendance.entity.Year;
import com.attendance.repository.BranchRepository;
import com.attendance.repository.SubjectRepository;
import com.attendance.repository.YearRepository;
import com.attendance.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin-only REST controller.
 * All endpoints require ROLE_ADMIN (enforced by SecurityConfig + @PreAuthorize).
 *
 * Base URL: /api/admin
 */
@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin", description = "Admin-only management endpoints")
public class AdminController {

    private final AdminService adminService;
    private final BranchRepository branchRepository;
    private final YearRepository yearRepository;
    private final SubjectRepository subjectRepository;

    // ── Dashboard ─────────────────────────────────────────────────

    @GetMapping("/dashboard/stats")
    @Operation(summary = "Get overall system statistics")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    // ── Branch Management ─────────────────────────────────────────

    @GetMapping("/branches")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "List all branches with their years")
    public ResponseEntity<List<Map<String, Object>>> getAllBranches() {
        List<Branch> branches = branchRepository.findAllWithYears();
        List<Map<String, Object>> response = branches.stream().map(b -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", b.getId());
            map.put("name", b.getName());
            map.put("code", b.getCode());
            map.put("description", b.getDescription());
            map.put("years", b.getYears());
            map.put("createdAt", b.getCreatedAt());
            map.put("updatedAt", b.getUpdatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/branches")
    @Operation(summary = "Create a new academic branch")
    public ResponseEntity<?> createBranch(@Valid @RequestBody BranchRequest req) {
        try {
            Branch branch = adminService.createBranch(req);
            log.info("Branch created: {} ({})", branch.getName(), branch.getCode());
            return ResponseEntity.status(HttpStatus.CREATED).body(branch);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/branches/{id}")
    @Operation(summary = "Delete a branch (cascades to years and subjects)")
    public ResponseEntity<Void> deleteBranch(@PathVariable UUID id) {
        branchRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Year Management ───────────────────────────────────────────

    @GetMapping("/years")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "List all academic years ordered by branch and year number")
    public ResponseEntity<List<Year>> getAllYears() {
        return ResponseEntity.ok(yearRepository.findAllOrderedByBranchAndYear());
    }

    @GetMapping("/years/branch/{branchId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "List years within a specific branch")
    public ResponseEntity<List<Year>> getYearsByBranch(@PathVariable UUID branchId) {
        return ResponseEntity.ok(yearRepository.findByBranchId(branchId));
    }

    @PostMapping("/years")
    @Operation(summary = "Create a new academic year within a branch")
    public ResponseEntity<?> createYear(
            @RequestParam UUID branchId,
            @RequestParam Short yearNumber,
            @RequestParam String label) {
        try {
            Year year = adminService.createYear(branchId, yearNumber, label);
            return ResponseEntity.status(HttpStatus.CREATED).body(year);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Subject Management ────────────────────────────────────────

    @GetMapping("/subjects")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "List all subjects")
    public ResponseEntity<List<Subject>> getAllSubjects() {
        return ResponseEntity.ok(subjectRepository.findAll());
    }

    @GetMapping("/subjects/year/{yearId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "List subjects for a specific year")
    public ResponseEntity<List<Subject>> getSubjectsByYear(@PathVariable UUID yearId) {
        return ResponseEntity.ok(subjectRepository.findByYearId(yearId));
    }

    @PostMapping("/subjects")
    @Operation(summary = "Create a new subject")
    public ResponseEntity<?> createSubject(@Valid @RequestBody SubjectRequest req) {
        try {
            Subject subject = adminService.createSubject(req);
            return ResponseEntity.status(HttpStatus.CREATED).body(subject);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/subjects/{id}")
    @Operation(summary = "Delete a subject")
    public ResponseEntity<Void> deleteSubject(@PathVariable UUID id) {
        subjectRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Student Management ────────────────────────────────────────

    @GetMapping("/students")
    @Operation(summary = "List all students")
    public ResponseEntity<List<UserSummaryDto>> getAllStudents() {
        return ResponseEntity.ok(adminService.getAllStudents());
    }

    @GetMapping("/students/year/{yearId}")
    @Operation(summary = "List students in a specific year")
    public ResponseEntity<List<UserSummaryDto>> getStudentsByYear(@PathVariable UUID yearId) {
        return ResponseEntity.ok(adminService.getStudentsByYear(yearId));
    }

    @PostMapping("/students")
    @Operation(summary = "Manually register a single student")
    public ResponseEntity<?> registerStudent(@Valid @RequestBody UserRegistrationDto dto) {
        try {
            dto.setRole("STUDENT");
            return ResponseEntity.status(HttpStatus.CREATED).body(adminService.registerStudent(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/students/{id}/toggle")
    @Operation(summary = "Enable or disable a student account")
    public ResponseEntity<Void> toggleStudent(
            @PathVariable UUID id,
            @RequestParam boolean enabled) {
        adminService.toggleStudentEnabled(id, enabled);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/students/{id}")
    @Operation(summary = "Delete a student account")
    public ResponseEntity<Void> deleteStudent(@PathVariable UUID id) {
        adminService.deleteStudent(id);
        return ResponseEntity.noContent().build();
    }

    // ── CSV Batch Upload ──────────────────────────────────────────

    /**
     * Bulk-register students from a CSV file.
     *
     * CSV format (with header row):
     *   Name, Email, RollNumber, YearId
     *
     * - Name      : Full student name
     * - Email     : College email address
     * - RollNumber: Unique institutional roll number
     * - YearId    : UUID of the year (get from GET /api/admin/years)
     */
    @PostMapping(value = "/students/batch-upload",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Bulk register students via CSV upload")
    public ResponseEntity<?> batchUpload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Please upload a valid CSV file."));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Only .csv files are accepted."));
        }

        log.info("Admin batch upload: {} ({} bytes)", filename, file.getSize());
        try {
            Map<String, Object> result = adminService.batchUploadStudents(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Batch upload failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── Teacher Management ────────────────────────────────────────

    @GetMapping("/teachers")
    @Operation(summary = "List all teachers")
    public ResponseEntity<List<UserSummaryDto>> getAllTeachers() {
        return ResponseEntity.ok(adminService.getAllTeachers());
    }

    @PostMapping("/teachers")
    @Operation(summary = "Register a new teacher")
    public ResponseEntity<?> registerTeacher(@Valid @RequestBody UserRegistrationDto dto) {
        try {
            dto.setRole("TEACHER");
            return ResponseEntity.status(HttpStatus.CREATED).body(adminService.registerTeacher(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/teachers/{id}/toggle")
    @Operation(summary = "Enable or disable a teacher account")
    public ResponseEntity<Void> toggleTeacher(
            @PathVariable UUID id,
            @RequestParam boolean enabled) {
        adminService.toggleTeacherEnabled(id, enabled);
        return ResponseEntity.ok().build();
    }
}
