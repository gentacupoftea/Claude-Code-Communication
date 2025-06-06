'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, User, Bell, Shield, Key, Globe } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

export default function SettingsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [_darkMode, _setDarkMode] = useState(true);

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
                <Link href="/settings" className="flex items-center space-x-2 text-[#1ABC9C]">
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
                <Link href="/analytics" className="block py-2 hover:text-[#1ABC9C]">
                  分析
                </Link>
                <Link href="/settings" className="block py-2 text-[#1ABC9C]">
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
        <div className="relative z-10 px-4 py-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">設定</h1>
            <p className="text-gray-400">
              アカウントとアプリケーションの設定を管理
            </p>
          </div>

          <div className="space-y-6">
            {/* プロフィール設定 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center mb-4">
                  <User className="w-6 h-6 text-[#1ABC9C] mr-3" />
                  <h3 className="text-xl font-bold">プロフィール設定</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">ユーザー名</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors"
                      defaultValue="Demo User"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">メールアドレス</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors"
                      defaultValue="demo@conea.ai"
                    />
                  </div>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* 通知設定 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center mb-4">
                  <Bell className="w-6 h-6 text-[#1ABC9C] mr-3" />
                  <h3 className="text-xl font-bold">通知設定</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>メール通知</span>
                    <button
                      onClick={() => setNotifications(!notifications)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        notifications ? 'bg-[#1ABC9C]' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>プッシュ通知</span>
                    <button
                      className="w-12 h-6 rounded-full bg-[#1ABC9C]"
                    >
                      <div className="w-5 h-5 bg-white rounded-full translate-x-6" />
                    </button>
                  </div>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* セキュリティ設定 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center mb-4">
                  <Shield className="w-6 h-6 text-[#1ABC9C] mr-3" />
                  <h3 className="text-xl font-bold">セキュリティ</h3>
                </div>
                <div className="space-y-4">
                  <button className="w-full text-left p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    パスワードを変更
                  </button>
                  <button className="w-full text-left p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    二段階認証を設定
                  </button>
                  <button className="w-full text-left p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    ログイン履歴を確認
                  </button>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* API設定 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center mb-4">
                  <Key className="w-6 h-6 text-[#1ABC9C] mr-3" />
                  <h3 className="text-xl font-bold">API設定</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">APIキー</label>
                    <div className="flex">
                      <input
                        type="password"
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-l-lg focus:outline-none focus:border-[#1ABC9C] transition-colors"
                        defaultValue="sk-xxxxxxxxxxxxxxxx"
                        readOnly
                        data-testid="api-key-input"
                      />
                      <button 
                        className="px-4 py-2 bg-[#1ABC9C] rounded-r-lg hover:bg-[#16A085] transition-colors"
                        data-testid="save-api-key-button"
                      >
                        再生成
                      </button>
                    </div>
                  </div>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* 言語・地域設定 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <GlassmorphicCard>
                <div className="flex items-center mb-4">
                  <Globe className="w-6 h-6 text-[#1ABC9C] mr-3" />
                  <h3 className="text-xl font-bold">言語・地域設定</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">言語</label>
                    <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">タイムゾーン</label>
                    <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                      <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                      <option value="America/New_York">America/New_York (UTC-5)</option>
                      <option value="Europe/London">Europe/London (UTC+0)</option>
                    </select>
                  </div>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* 保存ボタン */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <button className="bg-[#1ABC9C] px-8 py-3 rounded-lg font-semibold hover:bg-[#16A085] transition-all transform hover:scale-105">
                設定を保存
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}