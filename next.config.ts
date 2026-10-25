import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pinned so Turbopack doesn't walk up to the home directory looking for a
  // lockfile — there is a stray package-lock.json above this project.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
