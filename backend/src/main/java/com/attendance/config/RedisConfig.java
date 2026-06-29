package com.attendance.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis configuration for Upstash (free serverless Redis).
 *
 * Upstash is Redis-compatible and accessible over TLS.
 * Spring Boot auto-configures the connection from application.yml settings.
 * We only need to define our StringRedisTemplate bean here.
 *
 * Why StringRedisTemplate?
 *  - QR tokens are short-lived strings (UUID-like base64 values)
 *  - StringRedisTemplate avoids serialization overhead from RedisTemplate<Object,Object>
 *  - Simpler to inspect keys in Upstash console (plain text, not binary)
 */
@Configuration
public class RedisConfig {

    /**
     * StringRedisTemplate configured with String serializers for both keys and values.
     * Used by QrTokenService to store and retrieve QR tokens.
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
