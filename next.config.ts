import type { NextConfig } from "next";

import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = configDir;

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "*.replit.dev",
    "*.repl.co",
  ],
};

export default nextConfig;
