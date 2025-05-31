'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // ローディング完了後に認証チェック
    if (!isLoading && !isAuthenticated) {
      console.log('[ProtectedRoute] No authentication, redirecting to login');
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // ローディング中の場合はローディング画面を表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#1ABC9C] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white">ログイン確認中...</div>
        </div>
      </div>
    );
  }

  // 認証済みの場合はコンテンツを表示
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未認証の場合はnullを返す（リダイレクト処理は上で実行済み）
  return null;
};