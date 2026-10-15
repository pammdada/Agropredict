import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM packages must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "postgres"],
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
