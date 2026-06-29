package com.attendance.entity;

/**
 * Role enumeration for the unified User table.
 * Maps to PostgreSQL ENUM type 'user_role'.
 */
public enum UserRole {
    /** Full system administrator — can manage all entities. */
    ADMIN,

    /** College teacher — starts class sessions, generates QR codes. */
    TEACHER,

    /** Student — scans QR codes and submits face for attendance. */
    STUDENT
}
