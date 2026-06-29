package com.attendance.config;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * JPA AttributeConverter that maps float[] ↔ PostgreSQL vector(512).
 *
 * pgvector stores vectors as text in the format: '[0.1,0.2,...,0.9]'
 * This converter handles the serialization/deserialization transparently.
 *
 * Usage: annotate the entity field with @Convert(converter = FaceEmbeddingConverter.class)
 *
 * Note: For production at scale, consider using the pgvector JDBC driver
 * (pgvector-java) which provides native type support and enables ANN queries.
 */
@Converter
public class FaceEmbeddingConverter implements AttributeConverter<float[], String> {

    /**
     * Converts float[] → PostgreSQL vector string.
     * e.g. [0.12, 0.45, ...] → "[0.12,0.45,...]"
     */
    @Override
    public String convertToDatabaseColumn(float[] embedding) {
        if (embedding == null || embedding.length == 0) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < embedding.length; i++) {
            sb.append(embedding[i]);
            if (i < embedding.length - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Converts PostgreSQL vector string → float[].
     * e.g. "[0.12,0.45,...]" → [0.12f, 0.45f, ...]
     */
    @Override
    public float[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        // Strip surrounding brackets
        String stripped = dbData.trim().replaceAll("^\\[|]$", "");
        if (stripped.isEmpty()) {
            return new float[0];
        }
        String[] parts = stripped.split(",");
        float[] embedding = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            embedding[i] = Float.parseFloat(parts[i].trim());
        }
        return embedding;
    }
}
