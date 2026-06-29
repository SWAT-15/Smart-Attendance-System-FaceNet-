package com.attendance.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Admin entity subclass.
 * Admins have no extra columns in the database, so this entity
 * maps back to the admin table via the ADMIN discriminator.
 */
@Entity
@Table(name = "admin")
@PrimaryKeyJoinColumn(name = "user_id")
@DiscriminatorValue("ADMIN")
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@SuperBuilder
@NoArgsConstructor
public class Admin extends User {
}
