# ================================================================
#  Smart Attendance — Spring Boot Backend Dockerfile
#  Multi-stage build: Maven build → slim JRE runtime
#
#  Stage 1: Build JAR with Maven
#  Stage 2: Run with minimal JRE image
#
#  The dependency layer is cached separately for fast rebuilds.
# ================================================================

# ── Stage 1: Build ────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /app

# Copy pom.xml first — allows Docker to cache the dependency download layer
# Only re-downloads dependencies when pom.xml changes
COPY pom.xml .
RUN mvn dependency:go-offline -B --quiet

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B --quiet

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Expose the API port
EXPOSE 8080

# JVM tuning for containerized environments:
#  -Xms256m   → start heap at 256MB
#  -Xmx512m   → cap heap at 512MB (suitable for Railway free tier: 512MB RAM)
#  -XX:+UseContainerSupport → respect Docker CPU/memory limits
ENTRYPOINT ["java", \
  "-Xms256m", \
  "-Xmx512m", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
