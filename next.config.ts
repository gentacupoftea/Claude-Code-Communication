import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // API routes使用のためコメントアウト
  images: {
    unoptimized: true
  }
};

export default nextConfig;
