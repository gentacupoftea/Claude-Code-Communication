import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Mail, Lock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const success = await login(email, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('メールアドレスまたはパスワードが正しくありません');
      }
    } catch (_err) {
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative flex items-center justify-center">
      {/* 背景エフェクト */}
      <CyberGrid />
      <FloatingParticles />

      {/* ヘッダー */}
      <header className="absolute top-0 left-0 right-0 z-10 px-4 py-6 md:px-8">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="w-8 h-8 text-[#1ABC9C]" />
            <span className="text-2xl font-bold bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
              Conea AI
            </span>
          </Link>
        </nav>
      </header>

      {/* ログインフォーム */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4 sm:px-6 lg:px-8"
      >
        <GlassmorphicCard>
          <div className="text-center mb-8">
            <Bot className="w-12 h-12 sm:w-16 sm:h-16 text-[#1ABC9C] mx-auto mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              おかえりなさい
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              アカウントにログインして続行
            </p>
          </div>

          {/* デモ用のログイン情報 */}
          <div className="bg-[#1ABC9C]/20 border border-[#1ABC9C]/50 rounded-lg p-3 sm:p-4 mb-6">
            <p className="text-sm sm:text-base text-[#1ABC9C] font-semibold mb-1">デモアカウント</p>
            <p className="text-xs sm:text-sm text-gray-300">メール: demo@conea.ai</p>
            <p className="text-xs sm:text-sm text-gray-300">パスワード: demo123</p>
            <p className="text-xs text-gray-400 mt-2">※どのメールアドレス・パスワードでもログイン可能です</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors text-sm sm:text-base"
                  placeholder="your@email.com"
                  required
                  aria-label="メールアドレス"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#1ABC9C] transition-colors text-sm sm:text-base"
                  placeholder="••••••••"
                  required
                  aria-label="パスワード"
                  data-testid="password-input"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 bg-white/10 border border-white/20 rounded focus:ring-[#1ABC9C] focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900"
                  id="remember-me"
                  aria-describedby="remember-me-description"
                />
                <span id="remember-me-description" className="ml-2 text-sm text-gray-300">
                  ログイン状態を保持
                </span>
              </label>
              <Link 
                href="#" 
                className="text-sm text-[#1ABC9C] hover:underline focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:ring-offset-2 focus:ring-offset-gray-900 rounded px-1 py-1"
                aria-label="パスワードリセットページへ移動"
                data-testid="forgot-password-link"
              >
                パスワードを忘れた？
              </Link>
            </div>

            {error && (
              <div 
                className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm"
                role="alert"
                aria-live="polite"
                data-testid="error-message"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1ABC9C] py-3 rounded-lg font-semibold hover:bg-[#16A085] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:ring-offset-2 focus:ring-offset-gray-900"
              aria-label={isLoading ? "ログイン処理中..." : "ログインボタン"}
              data-testid="login-button"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" data-testid="loading-spinner" />
              ) : (
                <>
                  ログイン
                  <ChevronRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400">
              アカウントをお持ちでない方は
            </p>
            <Link href="#" className="text-[#1ABC9C] hover:underline" data-testid="signup-link">
              新規登録はこちら
            </Link>
          </div>
        </GlassmorphicCard>
      </motion.div>
    </div>
  );
}