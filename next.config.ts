import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers — HSTS on every route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // The Sui/Walrus/Seal SDKs pull in some node-targeted deps; keep them
  // external to the server bundle so Next doesn't try to bundle native bits.
  serverExternalPackages: ["@mysten/sui", "@mysten/walrus", "@mysten/seal"],
};

export default nextConfig;
