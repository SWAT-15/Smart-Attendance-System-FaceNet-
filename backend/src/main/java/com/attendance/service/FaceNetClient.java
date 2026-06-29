package com.attendance.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Service invoking the Python/FastAPI microservice to compute facial embeddings
 * and compare face frames.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FaceNetClient {

    private final WebClient.Builder webClientBuilder;

    @Value("${app.face.facenet-service-url}")
    private String facenetServiceUrl;

    @Data
    public static class VerifyRequest {
        private String sourceImageB64;
        private float[] targetEmbedding;
    }

    @Data
    public static class VerifyResponse {
        private boolean verified;
        private double distance;
        private double similarity;
    }

    @Data
    public static class EmbedRequest {
        private String imageB64;
    }

    @Data
    public static class EmbedResponse {
        private float[] embedding;
    }

    /**
     * Sends base64 image and target embedding vector to FaceNet service for validation.
     */
    public Mono<VerifyResponse> verifyFace(String imageFrameB64, float[] targetEmbedding) {
        VerifyRequest request = new VerifyRequest();
        request.setSourceImageB64(imageFrameB64);
        request.setTargetEmbedding(targetEmbedding);

        return webClientBuilder.build()
                .post()
                .uri(facenetServiceUrl + "/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(VerifyResponse.class)
                .onErrorResume(e -> {
                    if (e instanceof WebClientResponseException wcre
                            && wcre.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                        // 422 = MTCNN found no face in the image → client error, not service error
                        return Mono.error(new IllegalArgumentException(
                            "No face detected in the image. Ensure good lighting and face the camera directly."));
                    }
                    log.error("Failed to contact FaceNet microservice: {}", e.getMessage());
                    return Mono.empty();
                });
    }

    /**
     * Extracts embedding from a registration image.
     */
    public Mono<float[]> extractEmbedding(String imageFrameB64) {
        EmbedRequest request = new EmbedRequest();
        request.setImageB64(imageFrameB64);

        return webClientBuilder.build()
                .post()
                .uri(facenetServiceUrl + "/embed")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(EmbedResponse.class)
                .map(EmbedResponse::getEmbedding)
                .onErrorResume(e -> {
                    if (e instanceof WebClientResponseException wcre
                            && wcre.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                        // 422 = MTCNN found no face in the enrollment image → client error
                        return Mono.error(new IllegalArgumentException(
                            "No face detected in the enrollment image. Please use a clear, well-lit photo facing the camera."));
                    }
                    log.error("Failed to extract face embedding: {}", e.getMessage());
                    return Mono.empty();
                });
    }
}
