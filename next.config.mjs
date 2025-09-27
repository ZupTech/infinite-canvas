/** @type {import('next').NextConfig} */
import { withBotId } from "botid/next/config";

const HOST_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "https://myunite.ai";

const nextConfig = {
  devIndicators: false,
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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${HOST_URL}/api/:path*`,
      },
      {
        source: "/trigger/:path*",
        destination: `${HOST_URL}/trigger/:path*`,
      },
    ];
  },
};

export default withBotId(nextConfig);
