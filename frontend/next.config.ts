import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Allow cross-origin images (e.g., Supabase Storage face images)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Ignore @mediapipe/face_mesh during Turbopack build since it's loaded via CDN
  turbopack: {
    resolveAlias: {
      '@mediapipe/face_mesh': './src/utils/mock-mediapipe.js',
    },
  },
};

export default nextConfig;
