package com.attendance.entity;

/**
 * Status of a ClassSession lifecycle.
 * Maps to PostgreSQL ENUM type 'session_status'.
 */
public enum SessionStatus {
    /** Session is planned but not yet started. */
    SCHEDULED,

    /** Session is currently live — QR codes are being generated. */
    ACTIVE,

    /** Session has ended; no more attendance can be recorded. */
    COMPLETED,

    /** Session was cancelled. */
    CANCELLED
}
