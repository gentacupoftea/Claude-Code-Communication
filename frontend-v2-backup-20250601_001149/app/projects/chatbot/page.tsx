'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, MessageSquare, Play, Pause, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

export default function ChatbotPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const [isActive, setIsActive] = useState(true);

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
              <MessageSquare className="w-10 h-10 text-[#1ABC9C] mr-4" />
              <div>
                <h1 className="text-3xl font-bold">AIチャットボット</h1>
                <p className="text-gray-400">高度な自然言語処理で顧客対応を自動化</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {isActive ? 'アクティブ' : '停止中'}
              </span>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-green-500/20 hover:bg-green-500/30'}`}
              >
                {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* メイン設定 */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">チャットボット設定</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">ボット名</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors"
                        defaultValue="Conea Assistant"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">開始メッセージ</label>
                      <textarea
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors h-24"
                        defaultValue="こんにちは！何かお手伝いできることはありますか？"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">言語設定</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="ja">日本語</option>
                        <option value="en">English</option>
                        <option value="zh">中文</option>
                      </select>
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
                  <h3 className="text-xl font-bold mb-4">学習データ</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span>FAQ データセット</span>
                      <span className="text-[#1ABC9C]">1,234件</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span>カスタマーサポート履歴</span>
                      <span className="text-[#1ABC9C]">5,678件</span>
                    </div>
                    <button className="w-full p-3 border border-dashed border-[#1ABC9C] rounded-lg hover:bg-[#1ABC9C]/10 transition-colors">
                      新しいデータを追加
                    </button>
                  </div>
                </GlassmorphicCard>
              </motion.div>
            </div>

            {/* サイドバー */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">統計情報</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm">今日の対話数</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">234</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">平均応答時間</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">1.2秒</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">解決率</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">89%</p>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">アクション</h3>
                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-center space-x-2 p-3 bg-[#1ABC9C]/20 rounded-lg hover:bg-[#1ABC9C]/30 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                      <span>再トレーニング</span>
                    </button>
                    <button className="w-full flex items-center justify-center space-x-2 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                      <Bot className="w-4 h-4" />
                      <span>テスト実行</span>
                    </button>
                    <button className="w-full flex items-center justify-center space-x-2 p-3 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      <span>削除</span>
                    </button>
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