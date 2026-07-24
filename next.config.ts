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

  // The Hedera/Sui/Walrus SDKs pull in some node-targeted deps; keep them
  // external to the server bundle so Next doesn't try to bundle native bits.
  serverExternalPackages: ["@hashgraph/sdk", "hedera-agent-kit", "@mysten/walrus"],
};

export default nextConfig;
