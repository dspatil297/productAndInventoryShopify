import type { NextConfig } from "next";

const appUrl = process.env.SHOPIFY_APP_URL;

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcrypt"],
  // Product create posts multipart images; default 10MB truncates → FormData fail / hang.
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? [
          ".trycloudflare.com",
          ".ngrok-free.app",
          ".ngrok.io",
          ".firefist.co.in",
          "localhost",
        ]
      : appUrl
        ? [new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).host]
        : [],
};

export default nextConfig;
