package com.attendance.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Service to manage dynamic QR codes tokens using Redis cache with short TTLs.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QrTokenService {

    private final StringRedisTemplate redisTemplate;
    private static final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.qr.token-ttl-seconds}")
    private long tokenTtlSeconds;

    @Value("${app.qr.redis-key-prefix}")
    private String redisKeyPrefix;

    /**
     * Generates a cryptographically secure token, caches it in Redis linked to a classSessionId.
     * key: qr:session:{sessionId} -> token
     */
    public String generateAndCacheToken(UUID classSessionId) {
        byte[] randomBytes = new byte[24];
        secureRandom.nextBytes(randomBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        String key = redisKeyPrefix + classSessionId.toString();
        
        // Cache in Redis with short TTL
        redisTemplate.opsForValue().set(key, token, tokenTtlSeconds, TimeUnit.SECONDS);
        
        log.debug("Generated QR token for session {}: {}", classSessionId, token);
        return token;
    }

    /**
     * Validates if a token matches the cached token for a classSessionId.
     */
    public boolean validateToken(UUID classSessionId, String token) {
        String key = redisKeyPrefix + classSessionId.toString();
        String cachedToken = redisTemplate.opsForValue().get(key);
        
        return cachedToken != null && cachedToken.equals(token);
    }

    /**
     * Instantly deletes the cached token from Redis to prevent replay attacks.
     */
    public void invalidateToken(UUID classSessionId) {
        String key = redisKeyPrefix + classSessionId.toString();
        redisTemplate.delete(key);
        log.debug("Evicted QR token for session {}", classSessionId);
    }
}
