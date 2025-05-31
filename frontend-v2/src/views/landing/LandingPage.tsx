import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Zap, Shield, Users, ChevronRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative">
      {/* 背景エフェクト */}
      <CyberGrid />
      <FloatingParticles />

      {/* ヘッダー */}
      <header className="relative z-50 px-4 py-6 md:px-8">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2"
          >
            <Bot className="w-8 h-8 text-[#1ABC9C]" />
            <span className="text-2xl font-bold bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
              Conea AI
            </span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-6"
          >
            <Link 
              href="/login" 
              className="relative z-50 hover:text-[#1ABC9C] transition-colors cursor-pointer"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="relative z-50 bg-[#1ABC9C] px-6 py-2 rounded-full hover:bg-[#16A085] transition-colors cursor-pointer"
            >
              無料で始める
            </Link>
          </motion.div>
        </nav>
      </header>

      {/* ヒーローセクション */}
      <section className="relative z-10 px-4 py-20 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6"
          >
            AI技術で
            <span className="block bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
              ビジネスを進化させる
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl mb-12 text-gray-300 max-w-3xl mx-auto"
          >
            最先端のAIソリューションで、業務効率化と革新的な顧客体験を実現します
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/signup"
              className="relative z-50 bg-[#1ABC9C] px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#16A085] transition-all transform hover:scale-105 inline-flex items-center justify-center cursor-pointer"
            >
              無料で始める
              <ChevronRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="#features"
              className="relative z-50 border border-[#1ABC9C] px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#1ABC9C]/10 transition-all inline-flex items-center justify-center cursor-pointer"
            >
              詳しく見る
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section id="features" className="relative z-10 px-4 py-20 md:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
          >
            強力な機能で
            <span className="bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
              ビジネスを加速
            </span>
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassmorphicCard>
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-[#1ABC9C]/20 rounded-lg">
                      <feature.icon className="w-6 h-6 text-[#1ABC9C]" />
                    </div>
                    <h3 className="text-xl font-semibold ml-4">{feature.title}</h3>
                  </div>
                  <p className="text-gray-300">{feature.description}</p>
                </GlassmorphicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金プランセクション */}
      <section className="relative z-10 px-4 py-20 md:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
          >
            シンプルで透明な
            <span className="bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
              料金プラン
            </span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
            >
              <GlassmorphicCard className="h-full flex flex-col">
                <div className="p-8 flex-1">
                  <h3 className="text-2xl font-bold mb-2">Starter</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold text-[#1ABC9C]">$89</span>
                    <span className="text-gray-400 ml-2">/月</span>
                  </div>
                  <p className="text-gray-300 mb-8">
                    AIの力で、あなたのECビジネスを次のレベルへ。凄腕のデータアナリストをたった$89で。
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      基本的なAI分析機能
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      売上トレンド分析
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      在庫レポート
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      メールサポート
                    </li>
                  </ul>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href="/signup?plan=starter"
                    className="block w-full text-center bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-full transition-colors"
                  >
                    今すぐ始める
                  </Link>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* Professional Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <GlassmorphicCard className="h-full flex flex-col border-2 border-[#1ABC9C] relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[#1ABC9C] text-black px-4 py-1 rounded-full text-sm font-semibold">
                    人気プラン
                  </span>
                </div>
                <div className="p-8 flex-1">
                  <h3 className="text-2xl font-bold mb-2">Professional</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold text-[#1ABC9C]">$399</span>
                    <span className="text-gray-400 ml-2">/月</span>
                  </div>
                  <p className="text-gray-300 mb-8">
                    複数のAIが、あなたのビジネス成長を加速。売上予測から在庫最適化まで、すべて自動化。
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      高度なAI予測分析
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      自動在庫最適化
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      顧客行動分析
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      価格最適化提案
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      優先サポート
                    </li>
                  </ul>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href="/signup?plan=professional"
                    className="block w-full text-center bg-[#1ABC9C] hover:bg-[#16A085] px-6 py-3 rounded-full transition-colors font-semibold"
                  >
                    今すぐ始める
                  </Link>
                </div>
              </GlassmorphicCard>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <GlassmorphicCard className="h-full flex flex-col">
                <div className="p-8 flex-1">
                  <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold text-[#1ABC9C]">$2,499</span>
                    <span className="text-gray-400 ml-2">/月</span>
                  </div>
                  <p className="text-gray-300 mb-8">
                    独自のRAGシステムとMultiAI統合で、競合を圧倒する分析力を。
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      独自RAGシステム構築
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      MultiAI統合（GPT-4、Claude、Gemini）
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      カスタムAIモデル開発
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      専任サポートチーム
                    </li>
                    <li className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-[#1ABC9C] mr-2" />
                      API無制限アクセス
                    </li>
                  </ul>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href="/contact?plan=enterprise"
                    className="block w-full text-center bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-full transition-colors"
                  >
                    お問い合わせ
                  </Link>
                </div>
              </GlassmorphicCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA セクション */}
      <section className="relative z-10 px-4 py-20 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <GlassmorphicCard>
            <Sparkles className="w-12 h-12 text-[#1ABC9C] mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              今すぐAIの力を体験しよう
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              クレジットカード不要で、すぐに始められます
            </p>
            <Link
              href="/signup"
              className="relative z-50 bg-[#1ABC9C] px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#16A085] transition-all transform hover:scale-105 inline-flex items-center cursor-pointer"
            >
              無料トライアルを開始
              <ChevronRight className="ml-2 w-5 h-5" />
            </Link>
          </GlassmorphicCard>
        </div>
      </section>
    </div>
  );
}

const features = [
  {
    icon: Bot,
    title: "高度なAIアシスタント",
    description: "自然言語処理により、複雑なタスクも簡単に自動化できます。"
  },
  {
    icon: Zap,
    title: "リアルタイム処理",
    description: "高速処理により、大量のデータも瞬時に分析・処理します。"
  },
  {
    icon: Shield,
    title: "エンタープライズセキュリティ",
    description: "金融機関レベルのセキュリティで、お客様のデータを保護します。"
  },
  {
    icon: Users,
    title: "チーム協業",
    description: "チーム全体でAIツールを共有し、生産性を向上させます。"
  },
  {
    icon: Sparkles,
    title: "カスタマイズ可能",
    description: "ビジネスニーズに合わせて、AIモデルをカスタマイズできます。"
  },
  {
    icon: Bot,
    title: "24/7サポート",
    description: "専門チームが、導入から運用まで全面的にサポートします。"
  }
];