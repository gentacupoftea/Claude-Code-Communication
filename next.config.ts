import type { NextConfig } from "next";

const nextConfig: NextConfig = {
<<<<<<< HEAD
  output: 'export',
=======
  output: 'export', // スタティックエクスポート用
>>>>>>> feature/multillm-chat-integration
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // ビルド最適化設定
  experimental: {
    // optimizeCss: true, // 一時的に無効化
  },
  
  // コンパイラ最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error']
    } : false,
  },
  
  // 型チェック設定
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint設定
  eslint: {
    ignoreDuringBuilds: false,
  }
};

export default nextConfig;
