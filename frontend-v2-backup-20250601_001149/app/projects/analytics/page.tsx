'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, BarChart3, Database, Download, Upload } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

export default function DataAnalyticsPage() {
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
                <Link href="/analytics" className="flex items-center space-x-2 hover:text-[#1ABC9C] transition-colors">
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
        </nav>

        {/* メインコンテンツ */}
        <div className="relative z-10 px-4 py-8 max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <BarChart3 className="w-10 h-10 text-[#3498DB] mr-4" />
              <div>
                <h1 className="text-3xl font-bold">データ分析プロジェクト</h1>
                <p className="text-gray-400">リアルタイムでビジネスインサイトを提供</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
              アクティブ
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* メイン画面 */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">データソース</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Database className="w-5 h-5 text-[#1ABC9C] mr-2" />
                        <span className="font-semibold">PostgreSQL</span>
                      </div>
                      <p className="text-sm text-gray-400">売上データベース</p>
                      <p className="text-xs text-green-400 mt-1">接続中</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Database className="w-5 h-5 text-[#1ABC9C] mr-2" />
                        <span className="font-semibold">MongoDB</span>
                      </div>
                      <p className="text-sm text-gray-400">ユーザー行動ログ</p>
                      <p className="text-xs text-green-400 mt-1">接続中</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Database className="w-5 h-5 text-[#1ABC9C] mr-2" />
                        <span className="font-semibold">Google Analytics</span>
                      </div>
                      <p className="text-sm text-gray-400">Webサイト分析</p>
                      <p className="text-xs text-green-400 mt-1">接続中</p>
                    </div>
                    <div className="p-4 border border-dashed border-[#1ABC9C] rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#1ABC9C]/10 transition-colors">
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-[#1ABC9C] mx-auto mb-2" />
                        <span className="text-sm">新しいソースを追加</span>
                      </div>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <GlassmorphicCard>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">分析結果</h3>
                    <button className="flex items-center space-x-2 px-3 py-1 bg-[#1ABC9C]/20 rounded-lg hover:bg-[#1ABC9C]/30 transition-colors">
                      <Download className="w-4 h-4" />
                      <span className="text-sm">エクスポート</span>
                    </button>
                  </div>
                  <div className="h-80 bg-gray-800/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">インタラクティブなグラフエリア</p>
                      <p className="text-sm text-gray-500 mt-2">実際のプロジェクトではリアルタイムチャートが表示されます</p>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">分析設定</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">分析期間</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="7d">過去7日間</option>
                        <option value="30d">過去30日間</option>
                        <option value="90d">過去90日間</option>
                        <option value="1y">過去1年間</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">更新頻度</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="1m">1分毎</option>
                        <option value="5m">5分毎</option>
                        <option value="1h">1時間毎</option>
                        <option value="1d">1日毎</option>
                      </select>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>
            </div>

            {/* サイドバー */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">パフォーマンス</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm">処理速度</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">2.3秒</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">データ量</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">1.2TB</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">精度</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">94.5%</p>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">アラート設定</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">データ異常検知</span>
                      <div className="w-10 h-5 bg-[#1ABC9C] rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">パフォーマンス低下</span>
                      <div className="w-10 h-5 bg-[#1ABC9C] rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">トレンド変化</span>
                      <div className="w-10 h-5 bg-gray-600 rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5"></div>
                      </div>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}