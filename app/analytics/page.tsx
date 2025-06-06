'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

export default function AnalyticsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative">
        {/* 背景エフェクト */}
        <CyberGrid />
        <FloatingParticles count={30} />

        {/* ナビゲーションバー */}
        <nav className="relative z-20 bg-gray-900/50 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <Bot className="w-8 h-8 text-[#1ABC9C]" />
                  <span className="text-xl font-bold bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
                    Conea AI
                  </span>
                </Link>
              </div>

              {/* デスクトップメニュー */}
              <div className="hidden md:flex items-center space-x-8">
                <Link href="/dashboard" className="flex items-center space-x-2 hover:text-[#1ABC9C] transition-colors">
                  <Home className="w-5 h-5" />
                  <span>ダッシュボード</span>
                </Link>
                <Link href="/analytics" className="flex items-center space-x-2 text-[#1ABC9C]">
                  <BarChart className="w-5 h-5" />
                  <span>分析</span>
                </Link>
                <Link href="/settings" className="flex items-center space-x-2 hover:text-[#1ABC9C] transition-colors">
                  <Settings className="w-5 h-5" />
                  <span>設定</span>
                </Link>
                <button onClick={logout} className="flex items-center space-x-2 hover:text-red-400 transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span>ログアウト</span>
                </button>
              </div>

              {/* モバイルメニューボタン */}
              <button
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>

          {/* モバイルメニュー */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden bg-gray-900/95 backdrop-blur-lg border-t border-white/10"
            >
              <div className="px-4 py-4 space-y-2">
                <Link href="/dashboard" className="block py-2 hover:text-[#1ABC9C]">
                  ダッシュボード
                </Link>
                <Link href="/analytics" className="block py-2 text-[#1ABC9C]">
                  分析
                </Link>
                <Link href="/settings" className="block py-2 hover:text-[#1ABC9C]">
                  設定
                </Link>
                <button onClick={logout} className="block py-2 text-red-400">
                  ログアウト
                </button>
              </div>
            </motion.div>
          )}
        </nav>

        {/* メインコンテンツ */}
        <div className="relative z-10 px-4 py-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">データ分析</h1>
            <p className="text-gray-400 text-sm sm:text-base">
              AIプロジェクトのパフォーマンスと使用状況を分析
            </p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs sm:text-sm">総利用者数</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#1ABC9C]">1,234</p>
                  </div>
                  <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#1ABC9C]" />
                </div>
              </GlassmorphicCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs sm:text-sm">月間売上</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#1ABC9C]">¥567,890</p>
                  </div>
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-[#1ABC9C]" />
                </div>
              </GlassmorphicCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs sm:text-sm">処理成功率</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#1ABC9C]">98.5%</p>
                  </div>
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#1ABC9C]" />
                </div>
              </GlassmorphicCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs sm:text-sm">アクティブ率</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#1ABC9C]">87.2%</p>
                  </div>
                  <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-[#1ABC9C]" />
                </div>
              </GlassmorphicCard>
            </motion.div>
          </div>

          {/* 詳細分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <GlassmorphicCard>
                <h3 className="text-xl font-bold mb-4">使用量推移</h3>
                <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">グラフ表示エリア</p>
                </div>
              </GlassmorphicCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <GlassmorphicCard>
                <h3 className="text-xl font-bold mb-4">機能別利用率</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>AIチャットボット</span>
                      <span>75%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-[#1ABC9C] h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>データ分析</span>
                      <span>60%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-[#3498DB] h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>予測モデル</span>
                      <span>45%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-[#9B59B6] h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>
              </GlassmorphicCard>
            </motion.div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}