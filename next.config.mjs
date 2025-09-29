/** @type {import('next').NextConfig} */
import { withBotId } from "botid/next/config";

const basePath = process.env.NEXT_PUBLIC_MFE_BASEPATH ?? "";

const nextConfig = {
  devIndicators: false,
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  async rewrites() {
    return [
      { source: "/canvas", destination: "/" },
      { source: "/canvas/:path*", destination: "/:path*" },
    ];
  },
  webpack: (config) => {
    // Ignore canvas module which is required by Konva in Node environments
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    return config;
  },
  images: {
    domains: ["fal.ai", "storage.googleapis.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fal.media",
      },
      {
        protocol: "https",
        hostname: "v3.fal.media",
      },
    ],
  },
};

export default withBotId(nextConfig);
