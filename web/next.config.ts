import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "pg-native"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pg/**/*",
      "./node_modules/pg-pool/**/*",
      "./node_modules/pg-protocol/**/*",
      "./node_modules/pg-types/**/*",
      "./node_modules/pgpass/**/*",
      "./node_modules/postgres-array/**/*",
      "./node_modules/postgres-bytea/**/*",
      "./node_modules/postgres-date/**/*",
      "./node_modules/postgres-interval/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
