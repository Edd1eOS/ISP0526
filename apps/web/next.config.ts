import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next does not warn about the monorepo layout.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Transpile the workspace core package since it ships raw TS source.
  transpilePackages: ["@isp0526/core"],
};

export default nextConfig;
