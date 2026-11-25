import path from "node:path";
import type { NextConfig } from "next";

const appUrl = process.env.SHOPIFY_APP_URL;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  serverExternalPackages: ["bcrypt"],
  // Product create posts multipart images; default 10MB truncates → FormData fail / hang.
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
          },
        ],
      },
    ];
  },
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? [
          ".trycloudflare.com",
          ".ngrok-free.app",
          ".ngrok.io",
          "ims.firefist.co.in",
          ".firefist.co.in",
          "localhost",
        ]
      : appUrl
        ? [new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).host]
        : [],
};

export default nextConfig;
