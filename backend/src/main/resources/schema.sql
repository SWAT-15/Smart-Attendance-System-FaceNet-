-- ============================================================
--  Smart Attendance System — PostgreSQL DDL Schema
--  Database: attendance_db
--  Version : 1.0  |  2026-06-26
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector for face embeddings

-- ── ENUM Types ───────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
CREATE TYPE session_status AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE attend_status  AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- ============================================================
-- TABLE: branches
--   Represents a department / branch in the college.
--   e.g. "Computer Science", "Mechanical Engineering"
-- ============================================================
CREATE TABLE branches (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. "CS", "ME"
    description TEXT,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE branches IS 'Academic branches / departments in the college.';

-- ============================================================
-- TABLE: years
--   Represents an academic year within a branch.
--   e.g. "1st Year", "2nd Year"
-- ============================================================
CREATE TABLE years (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id   UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    year_number SMALLINT    NOT NULL CHECK (year_number BETWEEN 1 AND 6),
    label       VARCHAR(50) NOT NULL,   -- e.g. "1st Year", "Final Year"
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, year_number)
);

COMMENT ON TABLE years IS 'Academic years within a branch.';

-- ============================================================
-- TABLE: subjects
--   A course/subject taught within a branch year.
-- ============================================================
CREATE TABLE subjects (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    year_id     UUID        NOT NULL REFERENCES years(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    code        VARCHAR(30)  NOT NULL UNIQUE,   -- e.g. "CS301"
    credits     SMALLINT    DEFAULT 3,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subjects IS 'Subjects / courses within a branch year.';

-- ============================================================
-- TABLE: users
--   Unified user table for ADMIN, TEACHER, and STUDENT roles.
--   Uses single-table inheritance strategy in JPA.
-- ============================================================
CREATE TABLE users (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role            user_role   NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    profile_picture TEXT,                       -- URL from Google OAuth
    google_sub      VARCHAR(255) UNIQUE,        -- Google OAuth2 subject ID
    password_hash   VARCHAR(255),               -- NULL for OAuth-only users
    is_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
    is_locked       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'All system users: Admins, Teachers, Students.';
CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_google ON users(google_sub);

-- ============================================================
-- TABLE: students
--   Student-specific profile data (extends users).
--   Stores branch/year enrollment and face embedding vector.
-- ============================================================
CREATE TABLE students (
    user_id         UUID        NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    roll_number     VARCHAR(50) NOT NULL UNIQUE,
    year_id         UUID        NOT NULL REFERENCES years(id),
    face_embedding  vector(512),                -- 512-dim FaceNet embedding
    face_image_path TEXT,                       -- S3/local path to reference image
    face_enrolled   BOOLEAN     NOT NULL DEFAULT FALSE,
    enrolled_at     TIMESTAMP
);

COMMENT ON TABLE students IS 'Extended profile for STUDENT role users.';
CREATE INDEX idx_students_year        ON students(year_id);
CREATE INDEX idx_students_embedding   ON students USING ivfflat (face_embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================
-- TABLE: teachers
--   Teacher-specific profile data (extends users).
-- ============================================================
CREATE TABLE teachers (
    user_id         UUID        NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id     VARCHAR(50) NOT NULL UNIQUE,
    department      VARCHAR(100)
);

COMMENT ON TABLE teachers IS 'Extended profile for TEACHER role users.';

-- ============================================================
-- TABLE: teacher_subjects  (M:N join)
--   Maps which teachers teach which subjects.
-- ============================================================
CREATE TABLE teacher_subjects (
    teacher_id  UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id)      ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- ============================================================
-- TABLE: class_sessions
--   A specific lecture instance for a subject by a teacher.
--   This is what generates the QR code.
-- ============================================================
CREATE TABLE class_sessions (
    id              UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id      UUID            NOT NULL REFERENCES subjects(id),
    teacher_id      UUID            NOT NULL REFERENCES teachers(user_id),
    year_id         UUID            NOT NULL REFERENCES years(id),
    title           VARCHAR(255)    NOT NULL,   -- e.g. "Lecture 12 – Binary Trees"
    room            VARCHAR(100),               -- e.g. "Lab-3", "Room 201"
    scheduled_at    TIMESTAMP       NOT NULL,
    started_at      TIMESTAMP,
    ended_at        TIMESTAMP,
    status          session_status  NOT NULL DEFAULT 'SCHEDULED',
    -- QR token is stored in Redis, but we keep a reference here
    current_token   VARCHAR(255),               -- latest token (for audit)
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE class_sessions IS 'Individual lecture sessions that generate dynamic QR codes.';
CREATE INDEX idx_sessions_teacher  ON class_sessions(teacher_id);
CREATE INDEX idx_sessions_subject  ON class_sessions(subject_id);
CREATE INDEX idx_sessions_year     ON class_sessions(year_id);
CREATE INDEX idx_sessions_status   ON class_sessions(status);
CREATE INDEX idx_sessions_sched    ON class_sessions(scheduled_at);

-- ============================================================
-- TABLE: attendance_records
--   The final record of a student's attendance for a session.
--   Written once; update requires admin privilege.
-- ============================================================
CREATE TABLE attendance_records (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id          UUID            NOT NULL REFERENCES students(user_id)   ON DELETE RESTRICT,
    session_id          UUID            NOT NULL REFERENCES class_sessions(id)  ON DELETE RESTRICT,
    status              attend_status   NOT NULL DEFAULT 'PRESENT',
    marked_at           TIMESTAMP       NOT NULL DEFAULT NOW(),
    -- Face match quality metrics
    face_similarity     DECIMAL(5,4),           -- e.g. 0.9823 (cosine similarity)
    liveness_passed     BOOLEAN         NOT NULL DEFAULT FALSE,
    -- QR validation reference
    qr_token_used       VARCHAR(255),
    ip_address          VARCHAR(45),            -- IPv4 / IPv6
    device_info         TEXT,                   -- User-Agent string
    verification_method VARCHAR(50),
    -- Audit
    overridden_by       UUID            REFERENCES users(id),  -- Admin override
    override_reason     TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    -- A student can only have ONE record per session
    UNIQUE (student_id, session_id)
);

COMMENT ON TABLE attendance_records IS 'Final attendance records after QR + liveness + face match.';
CREATE INDEX idx_attend_student   ON attendance_records(student_id);
CREATE INDEX idx_attend_session   ON attendance_records(session_id);
CREATE INDEX idx_attend_marked    ON attendance_records(marked_at);
CREATE INDEX idx_attend_status    ON attendance_records(status);

-- ============================================================
-- TABLE: qr_audit_log
--   Immutable log of every QR scan attempt (success or fail).
--   Separate from attendance_records for security audit trail.
-- ============================================================
CREATE TABLE qr_audit_log (
    id              BIGSERIAL   NOT NULL PRIMARY KEY,
    session_id      UUID        REFERENCES class_sessions(id),
    student_id      UUID        REFERENCES students(user_id),
    qr_token        VARCHAR(255) NOT NULL,
    attempt_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    success         BOOLEAN     NOT NULL,
    failure_reason  VARCHAR(255),           -- 'TOKEN_EXPIRED', 'REPLAY', 'FACE_MISMATCH', etc.
    ip_address      VARCHAR(45),
    device_info     TEXT
);

COMMENT ON TABLE qr_audit_log IS 'Immutable security audit log for all QR scan attempts.';
CREATE INDEX idx_audit_session   ON qr_audit_log(session_id);
CREATE INDEX idx_audit_student   ON qr_audit_log(student_id);
CREATE INDEX idx_audit_attempt   ON qr_audit_log(attempt_at);

-- ============================================================
-- Trigger: auto-update updated_at columns
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_branches_upd       BEFORE UPDATE ON branches        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_years_upd          BEFORE UPDATE ON years           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subjects_upd       BEFORE UPDATE ON subjects        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_upd          BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_upd       BEFORE UPDATE ON class_sessions  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_upd     BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed Data — Default Admin User
-- ============================================================
INSERT INTO users (id, role, email, full_name, is_enabled)
VALUES (
    gen_random_uuid(),
    'ADMIN',
    'admin@college.edu',
    'System Administrator',
    TRUE
);
