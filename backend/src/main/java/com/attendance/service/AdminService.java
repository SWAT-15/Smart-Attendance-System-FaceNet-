package com.attendance.service;

import com.attendance.dto.*;
import com.attendance.entity.*;
import com.attendance.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Business logic for all Admin operations.
 * Separated from the controller to keep it thin and testable.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final BranchRepository branchRepository;
    private final YearRepository yearRepository;
    private final SubjectRepository subjectRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;

    // ── User Projections ──────────────────────────────────────────

    /** Maps a Student entity to a safe summary DTO (no password hash). */
    public UserSummaryDto toStudentSummary(Student s) {
        UserSummaryDto dto = new UserSummaryDto();
        dto.setId(s.getId());
        dto.setEmail(s.getEmail());
        dto.setFullName(s.getFullName());
        dto.setProfilePicture(s.getProfilePicture());
        dto.setRole(UserRole.STUDENT);
        dto.setIsEnabled(s.getIsEnabled());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setRollNumber(s.getRollNumber());
        dto.setFaceEnrolled(s.getFaceEnrolled());
        if (s.getYear() != null) {
            dto.setYearLabel(s.getYear().getLabel());
            if (s.getYear().getBranch() != null) {
                dto.setBranchName(s.getYear().getBranch().getName());
            }
        }
        return dto;
    }

    /** Maps a Teacher entity to a safe summary DTO. */
    public UserSummaryDto toTeacherSummary(Teacher t) {
        UserSummaryDto dto = new UserSummaryDto();
        dto.setId(t.getId());
        dto.setEmail(t.getEmail());
        dto.setFullName(t.getFullName());
        dto.setProfilePicture(t.getProfilePicture());
        dto.setRole(UserRole.TEACHER);
        dto.setIsEnabled(t.getIsEnabled());
        dto.setCreatedAt(t.getCreatedAt());
        dto.setEmployeeId(t.getEmployeeId());
        dto.setDepartment(t.getDepartment());
        return dto;
    }

    // ── Student CRUD ──────────────────────────────────────────────

    public List<UserSummaryDto> getAllStudents() {
        return studentRepository.findAll().stream()
                .map(this::toStudentSummary)
                .toList();
    }

    public List<UserSummaryDto> getStudentsByYear(UUID yearId) {
        return studentRepository.findByYearId(yearId).stream()
                .map(this::toStudentSummary)
                .toList();
    }

    @Transactional
    public UserSummaryDto registerStudent(UserRegistrationDto dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("Email already registered: " + dto.getEmail());
        }
        if (studentRepository.existsByRollNumber(dto.getRollNumber())) {
            throw new IllegalArgumentException("Roll number already exists: " + dto.getRollNumber());
        }

        Year year = yearRepository.findById(UUID.fromString(dto.getYearId()))
                .orElseThrow(() -> new IllegalArgumentException("Year not found: " + dto.getYearId()));

        Student student = new Student();
        student.setEmail(dto.getEmail());
        student.setFullName(dto.getFullName());
        student.setRole(UserRole.STUDENT);
        student.setRollNumber(dto.getRollNumber());
        student.setYear(year);
        student.setIsEnabled(true);
        student.setIsLocked(false);
        student.setFaceEnrolled(false);

        return toStudentSummary(studentRepository.save(student));
    }

    @Transactional
    public void toggleStudentEnabled(UUID studentId, boolean enabled) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NoSuchElementException("Student not found"));
        student.setIsEnabled(enabled);
        studentRepository.save(student);
    }

    @Transactional
    public void deleteStudent(UUID studentId) {
        studentRepository.deleteById(studentId);
    }

    // ── Teacher CRUD ──────────────────────────────────────────────

    public List<UserSummaryDto> getAllTeachers() {
        return teacherRepository.findAll().stream()
                .map(this::toTeacherSummary)
                .toList();
    }

    @Transactional
    public UserSummaryDto registerTeacher(UserRegistrationDto dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("Email already registered: " + dto.getEmail());
        }
        if (teacherRepository.existsByEmployeeId(dto.getEmployeeId())) {
            throw new IllegalArgumentException("Employee ID already exists: " + dto.getEmployeeId());
        }

        Teacher teacher = new Teacher();
        teacher.setEmail(dto.getEmail());
        teacher.setFullName(dto.getFullName());
        teacher.setRole(UserRole.TEACHER);
        teacher.setEmployeeId(dto.getEmployeeId());
        teacher.setDepartment(dto.getDepartment());
        teacher.setIsEnabled(true);
        teacher.setIsLocked(false);

        return toTeacherSummary(teacherRepository.save(teacher));
    }

    @Transactional
    public void toggleTeacherEnabled(UUID teacherId, boolean enabled) {
        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new NoSuchElementException("Teacher not found"));
        teacher.setIsEnabled(enabled);
        teacherRepository.save(teacher);
    }

    // ── Branch / Year / Subject CRUD ──────────────────────────────

    @Transactional
    public Branch createBranch(BranchRequest req) {
        if (branchRepository.existsByCode(req.getCode())) {
            throw new IllegalArgumentException("Branch code already exists: " + req.getCode());
        }
        Branch branch = Branch.builder()
                .name(req.getName())
                .code(req.getCode().toUpperCase())
                .description(req.getDescription())
                .build();
        return branchRepository.save(branch);
    }

    @Transactional
    public Year createYear(UUID branchId, Short yearNumber, String label) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new NoSuchElementException("Branch not found"));
        Year year = Year.builder()
                .branch(branch)
                .yearNumber(yearNumber)
                .label(label)
                .build();
        return yearRepository.save(year);
    }

    @Transactional
    public Subject createSubject(SubjectRequest req) {
        if (subjectRepository.existsByCode(req.getCode())) {
            throw new IllegalArgumentException("Subject code already exists: " + req.getCode());
        }
        Year year = yearRepository.findByIdWithBranchAndSubjects(req.getYearId())
                .orElseThrow(() -> new NoSuchElementException("Year not found"));
        Subject subject = Subject.builder()
                .name(req.getName())
                .code(req.getCode().toUpperCase())
                .credits(req.getCredits() != null ? req.getCredits() : 3)
                .year(year)
                .build();
        return subjectRepository.save(subject);
    }

    // ── CSV Batch Upload ──────────────────────────────────────────

    /**
     * Parses a CSV file and bulk-registers students.
     * Expected columns (case-insensitive): Name, Email, RollNumber, YearId
     * Returns a summary of successes and failures.
     */
    @Transactional
    public Map<String, Object> batchUploadStudents(MultipartFile file) {
        int successCount = 0;
        int failureCount = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                     new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader,
                     CSVFormat.DEFAULT
                             .builder()
                             .setHeader()
                             .setSkipHeaderRecord(true)
                             .setIgnoreHeaderCase(true)
                             .setTrim(true)
                             .build())) {

            for (CSVRecord record : parser) {
                long rowNum = record.getRecordNumber() + 1;
                try {
                    String name       = record.get("Name");
                    String email      = record.get("Email");
                    String rollNumber = record.get("RollNumber");
                    String yearIdStr  = record.get("YearId");

                    // Basic validation
                    if (name.isBlank() || email.isBlank() || rollNumber.isBlank() || yearIdStr.isBlank()) {
                        errors.add("Row " + rowNum + ": Missing required field(s).");
                        failureCount++;
                        continue;
                    }

                    if (userRepository.existsByEmail(email)) {
                        errors.add("Row " + rowNum + ": Email already exists — " + email);
                        failureCount++;
                        continue;
                    }

                    if (studentRepository.existsByRollNumber(rollNumber)) {
                        errors.add("Row " + rowNum + ": Roll number already exists — " + rollNumber);
                        failureCount++;
                        continue;
                    }

                    Year year = yearRepository.findById(UUID.fromString(yearIdStr))
                            .orElseThrow(() -> new NoSuchElementException("YearId not found: " + yearIdStr));

                    Student student = new Student();
                    student.setEmail(email.trim().toLowerCase());
                    student.setFullName(name.trim());
                    student.setRole(UserRole.STUDENT);
                    student.setRollNumber(rollNumber.trim().toUpperCase());
                    student.setYear(year);
                    student.setIsEnabled(true);
                    student.setIsLocked(false);
                    student.setFaceEnrolled(false);
                    studentRepository.save(student);
                    successCount++;

                } catch (Exception e) {
                    errors.add("Row " + rowNum + " error: " + e.getMessage());
                    failureCount++;
                    log.warn("CSV row {} failed: {}", rowNum, e.getMessage());
                }
            }

        } catch (Exception e) {
            log.error("CSV parsing failed: {}", e.getMessage());
            throw new RuntimeException("Failed to parse CSV file: " + e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("successCount", successCount);
        result.put("failureCount", failureCount);
        result.put("totalProcessed", successCount + failureCount);
        result.put("errors", errors);
        return result;
    }

    // ── Dashboard Stats ───────────────────────────────────────────

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalStudents",  studentRepository.count());
        stats.put("totalTeachers",  teacherRepository.count());
        stats.put("totalBranches",  branchRepository.count());
        stats.put("totalSubjects",  subjectRepository.count());
        stats.put("pendingFaceEnrollment",
                studentRepository.findStudentsPendingEnrollment().size());
        return stats;
    }
}
