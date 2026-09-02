import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // postgres.js is pure JS; no native package needed
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
