import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Let `next build` complete even with TypeScript errors (don't block the build on types).
  typescript: { ignoreBuildErrors: true },
  // ...and skip ESLint during the production build too.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
