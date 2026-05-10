import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Évite que Vercel prenne un lockfile parent (ex. ~/package-lock.json) pour le tracing.
  outputFileTracingRoot: path.join(process.cwd()),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
