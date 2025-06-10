import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev時のみ有効なリライト設定を追加
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },

  // output: 'export', // スタティックエクスポート用（一時的にコメントアウト）
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // 環境変数をNext.jsアプリケーションに公開
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  
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
