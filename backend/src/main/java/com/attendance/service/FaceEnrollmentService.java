package com.attendance.service;

import com.attendance.dto.FaceEnrollRequest;
import com.attendance.entity.Student;
import com.attendance.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * FaceEnrollmentService — handles all face enrollment operations.
 *
 * There are two enrollment paths:
 *
 *  1. ADMIN enrolls a student (used when students don't have webcam access):
 *     POST /api/admin/students/{studentId}/enroll-face
 *     Admin uploads a photo (JPEG/PNG) → backend extracts embedding via FaceNet → saved to DB
 *
 *  2. STUDENT self-enrolls (guided webcam capture):
 *     POST /api/student/enroll-face
 *     Student takes live photo → same FaceNet extraction → saved to their own record
 *     (Only allowed if not already enrolled, or admin has reset their enrollment)
 *
 * In both cases:
 *  - The base64 image is sent to the Python FaceNet microservice (/embed endpoint)
 *  - The returned 512-float embedding is stored in Supabase as vector(512)
 *  - faceEnrolled is set to true and enrolledAt is recorded
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FaceEnrollmentService {

    private final StudentRepository studentRepository;
    private final FaceNetClient faceNetClient;

    // ── Admin: Enroll a specific student ──────────────────────────

    /**
     * Called by admin — enrolls the student with the given UUID.
     *
     * @param studentId UUID of the student to enroll
     * @param req       FaceEnrollRequest containing base64 image
     * @return updated Student entity
     */
    @Transactional
    public Student adminEnrollStudent(UUID studentId, FaceEnrollRequest req) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NoSuchElementException("Student not found: " + studentId));

        return doEnroll(student, req);
    }

    // ── Student: Self-enroll ──────────────────────────────────────

    /**
     * Called by the logged-in student to enroll their own face.
     *
     * @param studentEmail email of the logged-in student
     * @param req          FaceEnrollRequest containing base64 image
     * @return updated Student entity
     */
    @Transactional
    public Student selfEnroll(String studentEmail, FaceEnrollRequest req) {
        Student student = studentRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Student not found: " + studentEmail));

        return doEnroll(student, req);
    }

    // ── Admin: Reset enrollment ───────────────────────────────────

    /**
     * Clears face enrollment for a student (e.g., after losing/corrupting face data).
     * After reset, the student must re-enroll before attending class.
     *
     * @param studentId UUID of the student to reset
     */
    @Transactional
    public void resetEnrollment(UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NoSuchElementException("Student not found: " + studentId));

        student.setFaceEmbedding(null);
        student.setFaceEnrolled(false);
        student.setEnrolledAt(null);
        student.setFaceImagePath(null);
        studentRepository.save(student);

        log.info("Face enrollment reset for student: {}", student.getEmail());
    }

    // ── Private Helpers ────────────────────────────────────────────

    /**
     * Core enrollment logic — shared by admin and student flows.
     * Calls FaceNet to extract embedding and saves it to the database.
     */
    private Student doEnroll(Student student, FaceEnrollRequest req) {
        if (req.getImageB64() == null || req.getImageB64().isBlank()) {
            throw new IllegalArgumentException("Image is required for face enrollment.");
        }

        // Extract 512-dimensional embedding via FaceNet microservice
        float[] embedding = faceNetClient.extractEmbedding(req.getImageB64()).block();

        if (embedding == null || embedding.length == 0) {
            throw new RuntimeException(
                "Face not detected in the provided image. " +
                "Please ensure clear lighting, face the camera directly, and try again."
            );
        }

        // Persist embedding and mark as enrolled
        student.setFaceEmbedding(embedding);
        student.setFaceEnrolled(true);
        student.setEnrolledAt(LocalDateTime.now());

        // Store image path if provided (e.g., Supabase Storage URL)
        if (req.getImagePath() != null && !req.getImagePath().isBlank()) {
            student.setFaceImagePath(req.getImagePath());
        } else {
            // Auto-generate a logical storage path for this student's reference image
            student.setFaceImagePath("face-references/" + student.getId() + ".jpg");
        }

        Student saved = studentRepository.save(student);
        log.info("✅ Face enrolled for student: {} (embedding dim: {})", student.getEmail(), embedding.length);
        return saved;
    }
}
