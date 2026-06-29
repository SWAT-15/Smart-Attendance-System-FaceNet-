package com.attendance.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Spring Security Configuration.
 *
 * Strategy: Fully stateless (STATELESS session policy).
 *  - Google OAuth2 → issues JWT → client stores it → sends as Bearer header
 *  - JWT filter validates each request independently, no server-side sessions
 *  - RBAC enforced via @PreAuthorize at the service/controller layer
 *
 * Route Security:
 *  PUBLIC  → /auth/**, /oauth2/**, /actuator/health, /v3/api-docs, /swagger-ui, /ws/**
 *  PRIVATE → everything else (requires valid JWT with matching role)
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)  // enables @PreAuthorize / @PostAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final JwtAuthEntryPoint jwtAuthEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // ── CORS (React frontend on :3000) ────────────────────
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // ── Disable CSRF (stateless REST API, no cookies) ─────
            .csrf(AbstractHttpConfigurer::disable)

            // ── Stateless session — no HttpSession created ─────────
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ── Custom 401/403 handlers (return JSON, not HTML) ───────
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler))

            // ── Route Authorization Rules ──────────────────────────
            .authorizeHttpRequests(auth -> auth
                // Auth endpoints (login, OAuth callback)
                .requestMatchers(
                    "/auth/**",
                    "/oauth2/**"
                ).permitAll()
                // WebSocket handshake — JWT validated at message level
                .requestMatchers("/ws/**").permitAll()
                // Actuator health (used by Render/Railway free tier healthchecks)
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // Swagger / OpenAPI docs
                .requestMatchers(
                    "/v3/api-docs/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html"
                ).permitAll()

                // ── Role-based routes ──────────────────────────────
                .requestMatchers(HttpMethod.GET, "/admin/branches", "/admin/years/**", "/admin/subjects/**").hasAnyRole("ADMIN", "TEACHER")
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .requestMatchers("/teacher/**").hasRole("TEACHER")
                .requestMatchers("/student/**").hasRole("STUDENT")

                // Everything else → must be authenticated
                .anyRequest().authenticated()
            )

            // ── Google OAuth2 Login ────────────────────────────────
            .oauth2Login(oauth2 -> oauth2
                // URL the React app links to: /oauth2/authorization/google
                .authorizationEndpoint(auth ->
                    auth.baseUri("/oauth2/authorization"))
                // Must match Google Cloud Console redirect URI
                .redirectionEndpoint(redir ->
                    redir.baseUri("/auth/oauth2/callback/*"))
                .successHandler(oAuth2LoginSuccessHandler)
                .failureUrl(frontendUrl + "/auth-error?error=OAUTH_FAILED")
            );

        // ── JWT filter runs BEFORE username/password auth filter ───
        http.addFilterBefore(jwtAuthenticationFilter,
                UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);  // strength 12 for better security
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * CORS configuration allowing the Next.js frontend (and Vercel deploys).
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Use setAllowedOriginPatterns for wildcards in Spring Boot when allowCredentials is true
        config.setAllowedOriginPatterns(List.of(
            "http://localhost:3000",    // Next.js local dev
            "http://localhost:3001",
            "https://*.vercel.app",     // Vercel (free) preview deployments
            frontendUrl                 // The exact frontend URL from environment
        ));

        config.setAllowedMethods(Arrays.asList(
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
        ));

        config.setAllowedHeaders(Arrays.asList(
            "Authorization",
            "Content-Type",
            "Cache-Control",
            "X-Requested-With",
            "Accept"
        ));

        config.setExposedHeaders(Collections.singletonList("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);  // Preflight cache for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
