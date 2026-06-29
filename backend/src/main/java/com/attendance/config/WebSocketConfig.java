package com.attendance.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket (STOMP) Configuration.
 *
 * Topics used:
 *  /topic/session/{sessionId}/qr    → QR_ROTATE events (teacher's projector subscribes)
 *  /topic/session/{sessionId}       → SESSION_ENDED events
 *  /topic/session/{sessionId}/feed  → ATTENDANCE_MARKED events (live student feed)
 *
 * Client connection flow (Next.js):
 *   1. import SockJS from 'sockjs-client'
 *   2. import Stomp from 'stompjs'
 *   3. const socket = new SockJS('http://localhost:8080/api/ws')
 *   4. const client = Stomp.over(socket)
 *   5. client.connect({ Authorization: 'Bearer <jwt>' }, () => {
 *        client.subscribe('/topic/session/<id>/qr', msg => ...)
 *      })
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Clients subscribe to /topic/... destinations
        config.enableSimpleBroker("/topic");
        // Messages sent from client go to @MessageMapping methods with /app prefix
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                // Allow local dev + configured frontend (Vercel etc.)
                .setAllowedOrigins(
                    "http://localhost:3000",
                    "http://localhost:3001",
                    frontendUrl
                )
                .withSockJS();  // SockJS fallback for browsers without native WS
    }
}
