package com.attendance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Smart Attendance System — Spring Boot Application Entry Point.
 *
 * Features:
 *  - @EnableJpaAuditing: Activates @CreationTimestamp / @UpdateTimestamp on entities
 *  - @EnableAsync: Allows async face-recognition calls to FaceNet microservice
 *  - @EnableScheduling: Powers the auto-absent marking job after session ends
 */
@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
@EnableScheduling
public class SmartAttendanceApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartAttendanceApplication.class, args);
    }
}
