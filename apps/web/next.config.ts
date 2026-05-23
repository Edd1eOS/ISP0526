import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next does not warn about the monorepo layout.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
