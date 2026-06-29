package com.attendance.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

/**
 * JWT Token Provider — generates, validates, and parses JSON Web Tokens.
 *
 * Token structure:
 *  - Subject:   user's email (stable identifier)
 *  - Claim "roles": ["ROLE_STUDENT"] (used for RBAC)
 *  - IssuedAt / Expiration
 *  - Signed with HMAC-SHA256 using a 256-bit secret key
 *
 * Used by:
 *  - OAuth2LoginSuccessHandler (create token after Google login)
 *  - AuthController (create token after email/password login)
 *  - JwtAuthenticationFilter (validate token on every request)
 */
@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        // Key must be at least 256 bits (32 chars) for HMAC-SHA256
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                "JWT secret must be at least 32 characters. Current length: " + keyBytes.length);
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("JWT signing key initialized successfully.");
    }

    /**
     * Generates a JWT from a Spring Security Authentication object.
     * Works for both UsernamePasswordAuthenticationToken and OAuth2 flows.
     */
    public String generateToken(Authentication authentication) {
        String email = authentication.getName();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());
        return buildToken(email, roles);
    }

    /**
     * Generates a JWT directly from email + role strings.
     * Used after OAuth2 login where we construct the auth token manually.
     */
    public String generateTokenFromEmail(String email, List<String> roles) {
        return buildToken(email, roles);
    }

    private String buildToken(String email, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /** Extracts email (subject) from a valid JWT. */
    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    /** Extracts role list from a valid JWT. */
    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        return parseClaims(token).get("roles", List.class);
    }

    /** Returns true if the token is structurally valid and not expired. */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT expired: {}", e.getMessage());
        } catch (JwtException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT string is empty or null: {}", e.getMessage());
        }
        return false;
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
