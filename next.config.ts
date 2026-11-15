import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Migusto recipe photography
      { protocol: "https", hostname: "recipeimages.migros.ch", pathname: "/**" },
      // Betty Bossi recipe photography
      { protocol: "https", hostname: "media.bettybossi.ch", pathname: "/**" },
      // FOOBY (Coop) recipe photography
      { protocol: "https", hostname: "recipecontent.fooby.ch", pathname: "/**" },
      // Migros product photography (api.migros.ch returns {stack} templates we resolve locally)
      { protocol: "https", hostname: "image.migros.ch", pathname: "/**" },
    ],
  },
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
