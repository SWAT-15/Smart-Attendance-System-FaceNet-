package com.attendance.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Returns a structured JSON 403 response when an authenticated user
 * accesses a route that requires a different role.
 *
 * Without this, Spring Security re-routes AccessDeniedException through
 * /error, which loses the JWT context and triggers the AuthenticationEntryPoint
 * returning 401 — semantically incorrect for an authenticated but unauthorized user.
 */
@Component
@Slf4j
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {

        log.warn("Access denied for {} on {}: {}",
                request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "unknown",
                request.getRequestURI(),
                accessDeniedException.getMessage());

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", 403);
        body.put("error", "Forbidden");
        body.put("message", "You do not have permission to access this resource.");
        body.put("path", request.getRequestURI());
        body.put("timestamp", Instant.now().toString());

        mapper.writeValue(response.getOutputStream(), body);
    }
}
