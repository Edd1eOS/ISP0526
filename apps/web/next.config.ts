import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root so Next does not warn about the monorepo layout.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Transpile the workspace core package since it ships raw TS source.
  transpilePackages: ["@isp0526/core"],
  // Native node addons must not be bundled by Turbopack / webpack; they are
  // resolved at runtime via require() from the pnpm store. @react-pdf/renderer
  // pulls in pdfkit which uses node fs/crypto at runtime; @resvg/resvg-js
  // ships platform-specific .node binaries via optionalDependencies.
  serverExternalPackages: ["@resvg/resvg-js", "@react-pdf/renderer"],
};

export default withNextIntl(nextConfig);
