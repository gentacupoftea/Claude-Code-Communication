import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // スタティックエクスポート用
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true
};

export default nextConfig;
