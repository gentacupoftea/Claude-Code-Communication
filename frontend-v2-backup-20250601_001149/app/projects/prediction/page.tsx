'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

export default function PredictionModelPage() {
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
              <Brain className="w-10 h-10 text-[#9B59B6] mr-4" />
              <div>
                <h1 className="text-3xl font-bold">予測モデル</h1>
                <p className="text-gray-400">機械学習で未来のトレンドを予測</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-sm bg-orange-500/20 text-orange-400">
              準備中
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
                  <h3 className="text-xl font-bold mb-4">モデル設定</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">予測対象</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="sales">売上予測</option>
                        <option value="demand">需要予測</option>
                        <option value="churn">顧客離脱予測</option>
                        <option value="stock">在庫予測</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">予測期間</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="1w">1週間</option>
                        <option value="1m">1ヶ月</option>
                        <option value="3m">3ヶ月</option>
                        <option value="1y">1年</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">アルゴリズム</label>
                      <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors">
                        <option value="lstm">LSTM</option>
                        <option value="rf">Random Forest</option>
                        <option value="xgb">XGBoost</option>
                        <option value="arima">ARIMA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">精度閾値</label>
                      <input
                        type="range"
                        min="70"
                        max="99"
                        defaultValue="85"
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>70%</span>
                        <span>85%</span>
                        <span>99%</span>
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
                  <h3 className="text-xl font-bold mb-4">トレーニングデータ</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                        <span>過去3年間の売上データ</span>
                      </div>
                      <span className="text-[#1ABC9C]">50,000件</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                        <span>季節性データ</span>
                      </div>
                      <span className="text-[#1ABC9C]">12,000件</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 text-orange-400 mr-3" />
                        <span>外部要因データ</span>
                      </div>
                      <span className="text-orange-400">準備中</span>
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
                  <h3 className="text-xl font-bold mb-4">予測結果</h3>
                  <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">モデルトレーニング完了後に予測結果が表示されます</p>
                      <button className="mt-4 px-6 py-2 bg-[#1ABC9C] rounded-lg hover:bg-[#16A085] transition-colors">
                        トレーニング開始
                      </button>
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
                  <h3 className="text-xl font-bold mb-4">モデル性能</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm">精度 (Accuracy)</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">--%</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">RMSE</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">--</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">MAE</p>
                      <p className="text-2xl font-bold text-[#1ABC9C]">--</p>
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
                  <h3 className="text-xl font-bold mb-4">トレーニング状況</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">データ準備</span>
                        <span className="text-sm text-[#1ABC9C]">100%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-[#1ABC9C] h-2 rounded-full w-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">特徴量エンジニアリング</span>
                        <span className="text-sm text-[#1ABC9C]">100%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-[#1ABC9C] h-2 rounded-full w-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">モデルトレーニング</span>
                        <span className="text-sm text-gray-400">0%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-gray-600 h-2 rounded-full w-0"></div>
                      </div>
                    </div>
                  </div>
                </GlassmorphicCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <GlassmorphicCard>
                  <h3 className="text-xl font-bold mb-4">スケジュール</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">自動再トレーニング</span>
                      <div className="w-10 h-5 bg-[#1ABC9C] rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">頻度</label>
                      <select className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-sm">
                        <option value="daily">毎日</option>
                        <option value="weekly">毎週</option>
                        <option value="monthly">毎月</option>
                      </select>
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