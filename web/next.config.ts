import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async rewrites() {
    return [
      { source: "/p/:slug", destination: "/project/:slug" },
      { source: "/p/:slug/settings", destination: "/project/:slug/settings" },
    ];
  },
};

export default nextConfig;
