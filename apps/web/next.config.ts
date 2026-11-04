import type { NextConfig } from "next";
import { apiRewrites } from "./src/lib/api-routes";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // The browser reaches the API through the shop's own address, so the refresh cookie is
  // first-party (ADR 0012). API_URL is read when the shop is built.
  rewrites: async () => apiRewrites(process.env.API_URL),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
