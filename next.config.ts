import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  outputFileTracingExcludes: {
    "/*": [".runtime", ".runtime/**/*", ".runtime-f-drive-backup-*/**/*", ".ai-pet-world-data", ".ai-pet-world-data/**/*"],
    "*": [".runtime/**/*", ".runtime-f-drive-backup-*/**/*"],
    "/api/ai-painter/training-data-image": [".runtime/**/*"],
  },
};

export default nextConfig;
