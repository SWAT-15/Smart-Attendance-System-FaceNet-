package com.attendance.security;

import com.attendance.entity.User;
import com.attendance.entity.UserRole;
import com.attendance.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

/**
 * Handles successful Google OAuth2 logins.
 *
 * Flow:
 *  1. Extract email/name/picture/sub from the Google ID token.
 *  2. Validate that the email domain is in the allowed list (college domain gate).
 *  3. Find the user in Supabase DB by email, or provision a new STUDENT record.
 *  4. Generate a JWT with the user's role claim.
 *  5. Redirect to the Next.js frontend at /oauth2/redirect?token=<jwt>
 *
 * Security note: The JWT is sent as a URL query param only over HTTPS in production.
 * For local dev this is acceptable.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    /** Injected from application.yml → app.security.allowed-email-domains */
    @Value("${app.security.allowed-email-domains}")
    private List<String> allowedDomains;

    /** Frontend base URL — different in dev vs production */
    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    @Transactional   // ← Required: DB save runs inside the HTTP callback thread
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        String email   = oAuth2User.getAttribute("email");
        String name    = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");
        String sub     = oAuth2User.getAttribute("sub");   // stable Google user ID

        // ── Guard: email must be present ──────────────────────────
        if (email == null) {
            log.error("Google OAuth2 did not return an email address.");
            response.sendRedirect(frontendUrl + "/auth-error?error=EMAIL_MISSING");
            return;
        }

        // ── Guard: domain must be in allowed list ──────────────────
        boolean isAllowedDomain = allowedDomains.stream()
                .anyMatch(domain -> email.toLowerCase().endsWith("@" + domain.toLowerCase()
                        .replaceFirst("^@", "")));   // handle both "@college.edu" and "college.edu"

        if (!isAllowedDomain) {
            log.warn("OAuth login rejected — domain not in whitelist: {}", email);
            response.sendRedirect(frontendUrl + "/auth-error?error=DOMAIN_NOT_ALLOWED");
            return;
        }

        // ── Find or provision user in Supabase DB ─────────────────
        User user = userRepository.findByEmail(email)
                .map(existing -> updateExistingUser(existing, sub, picture))
                .orElseGet(() -> createNewStudent(email, name, sub, picture));

        if (!user.getIsEnabled()) {
            log.warn("Disabled user tried to log in via OAuth: {}", email);
            response.sendRedirect(frontendUrl + "/auth-error?error=ACCOUNT_DISABLED");
            return;
        }

        // ── Generate JWT ───────────────────────────────────────────
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                user.getEmail(),
                null,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );

        String jwt = tokenProvider.generateToken(authToken);

        // ── Redirect to Next.js with JWT ───────────────────────────
        String targetUrl = UriComponentsBuilder
                .fromUriString(frontendUrl + "/oauth2/redirect")
                .queryParam("token", jwt)
                .build().toUriString();

        log.info("OAuth2 login successful for {} (role={})", email, user.getRole());
        clearAuthenticationAttributes(request);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    // ── Private helpers ────────────────────────────────────────────

    private User updateExistingUser(User user, String sub, String picture) {
        boolean dirty = false;
        if (sub != null && user.getGoogleSub() == null) {
            user.setGoogleSub(sub);
            dirty = true;
        }
        if (picture != null && !picture.equals(user.getProfilePicture())) {
            user.setProfilePicture(picture);
            dirty = true;
        }
        if (dirty) {
            userRepository.save(user);
        }
        return user;
    }

    private User createNewStudent(String email, String name, String sub, String picture) {
        User newUser = User.builder()
                .email(email)
                .fullName(name != null ? name : extractNameFromEmail(email))
                .googleSub(sub)
                .profilePicture(picture)
                .role(UserRole.STUDENT)   // Default role; Admin promotes as needed
                .isEnabled(true)
                .isLocked(false)
                .build();
        userRepository.save(newUser);
        log.info("Provisioned new STUDENT via Google OAuth: {}", email);
        return newUser;
    }

    /** Fallback display name from email prefix if Google doesn't supply a name. */
    private String extractNameFromEmail(String email) {
        return email.split("@")[0].replace(".", " ").replace("_", " ");
    }
}
