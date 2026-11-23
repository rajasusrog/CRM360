import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost", "**.run.app", "**.trycloudflare.com"],
  async rewrites() {
    return [
      {
        source: "/sb/:path*",
        destination: "http://127.0.0.1:54321/:path*",
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
