import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // スタティックエクスポート用
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // ビルド最適化設定
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
  },
  
  // コンパイラ最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error']
    } : false,
  },
  
  // パフォーマンス最適化
  swcMinify: true,
  
  // 静的ファイル最適化
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  
  // 圧縮設定
  compress: true,
  
  // 型チェック最適化
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint設定
  eslint: {
    ignoreDuringBuilds: false,
  }
};

export default nextConfig;
