package com.attendance.entity;

/**
 * Attendance status for a student in a specific session.
 * Maps to PostgreSQL ENUM type 'attend_status'.
 */
public enum AttendanceStatus {
    /** Student was present and passed all verification checks. */
    PRESENT,

    /** Student was not present (default after session ends). */
    ABSENT,

    /** Student arrived after the allowed window. */
    LATE,

    /** Admin-granted excused absence. */
    EXCUSED
}
