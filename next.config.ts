import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": [".runtime/**/*", ".runtime-f-drive-backup-*/**/*"],
    "/api/ai-painter/training-data-image": [".runtime/**/*"],
  },
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/.runtime/**", "**/.runtime-f-drive-backup-*/**", "D:/AI-PET-WORLD-DATA/**"],
    }
    return config
  },
};

export default nextConfig;
