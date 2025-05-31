'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Home, BarChart, Settings, LogOut, Menu, X, Plus, MessageSquare, BarChart3, Brain, Zap } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function CreatePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const projectTypes = [
    {
      id: 'chatbot',
      title: 'AIチャットボット',
      description: '自然言語処理を活用したインテリジェントなチャットボットを作成',
      icon: MessageSquare,
      color: '#1ABC9C',
      features: ['自然言語理解', 'コンテキスト保持', 'マルチ言語対応', 'カスタマイズ可能']
    },
    {
      id: 'analytics',
      title: 'データ分析',
      description: '大量のデータから洞察を得るための分析ツールを構築',
      icon: BarChart3,
      color: '#3498DB',
      features: ['リアルタイム分析', 'ビジュアル化', 'レポート生成', '予測分析']
    },
    {
      id: 'prediction',
      title: '予測モデル',
      description: '機械学習を使用してトレンドや結果を予測するモデルを開発',
      icon: Brain,
      color: '#9B59B6',
      features: ['機械学習', 'パターン認識', 'トレンド予測', 'アラート機能']
    },
    {
      id: 'automation',
      title: '自動化ツール',
      description: '業務プロセスを自動化するワークフローを設計',
      icon: Zap,
      color: '#E67E22',
      features: ['ワークフロー', 'タスク自動化', 'スケジュール実行', 'エラー処理']
    }
  ];

  const handleCreateProject = (type: string) => {
    // 実際のプロジェクト作成ロジックをここに実装
    alert(`${type}プロジェクトを作成します。この機能は準備中です。`);
    router.push('/dashboard');
  };

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
        <div className="relative z-10 px-4 py-8 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">新しいプロジェクトを作成</h1>
            <p className="text-gray-400 text-lg">
              AIの力を活用して、革新的なソリューションを構築しましょう
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {projectTypes.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer"
                onClick={() => handleCreateProject(project.title)}
              >
                <GlassmorphicCard className="h-full hover:scale-105 transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <div 
                      className="p-3 rounded-lg mr-4"
                      style={{ backgroundColor: `${project.color}20` }}
                    >
                      <project.icon 
                        className="w-8 h-8" 
                        style={{ color: project.color }}
                      />
                    </div>
                    <h3 className="text-2xl font-bold">{project.title}</h3>
                  </div>
                  
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    {project.description}
                  </p>

                  <div className="mb-6">
                    <h4 className="font-semibold mb-3 text-[#1ABC9C]">主な機能:</h4>
                    <ul className="space-y-2">
                      {project.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-[#1ABC9C] rounded-full mr-3"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm font-medium"
                      style={{ color: project.color }}
                    >
                      詳細を見る
                    </span>
                    <Plus className="w-5 h-5 text-[#1ABC9C] group-hover:rotate-90 transition-transform duration-300" />
                  </div>
                </GlassmorphicCard>
              </motion.div>
            ))}
          </div>

          {/* カスタムプロジェクト */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <GlassmorphicCard className="text-center">
              <h3 className="text-2xl font-bold mb-4">カスタムプロジェクト</h3>
              <p className="text-gray-300 mb-6">
                独自の要件に基づいてカスタムAIソリューションを開発したい場合は、
                お気軽にお問い合わせください。
              </p>
              <button className="bg-[#1ABC9C] px-8 py-3 rounded-lg font-semibold hover:bg-[#16A085] transition-all transform hover:scale-105">
                相談する
              </button>
            </GlassmorphicCard>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  );
}