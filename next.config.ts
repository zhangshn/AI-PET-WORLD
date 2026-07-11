import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/ai-painter/training-data-image": [".runtime/**/*"],
  },
};

export default nextConfig;
