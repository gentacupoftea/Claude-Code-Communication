'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { authManager } from '@/src/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuth();
  const router = useRouter();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    console.log('[ProtectedRoute] Auth state check:', { 
      isAuthenticated, 
      isLoading, 
      isInitialized,
      hasValidToken: authManager.hasValidToken(),
      hasCheckedAuth
    });
    
    // 認証チェックを一度だけ実行
    if (isInitialized && !isLoading && !hasCheckedAuth) {
      setHasCheckedAuth(true);
      const hasToken = authManager.hasValidToken();
      
      if (!isAuthenticated && !hasToken) {
        console.log('[ProtectedRoute] No authentication, redirecting to login');
        router.replace('/login'); // pushではなくreplaceを使用
        return;
      }
      
      console.log('[ProtectedRoute] Authentication check passed');
    }
  }, [isAuthenticated, isLoading, isInitialized, router, hasCheckedAuth]);

  // 初期化中またはロード中の場合はローディング画面を表示
  if (!isInitialized || isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#1ABC9C] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white">ログイン確認中...</div>
        </div>
      </div>
    );
  }

  // 認証状態またはトークンがある場合はコンテンツを表示
  if (isAuthenticated || authManager.hasValidToken()) {
    console.log('[ProtectedRoute] Rendering protected content');
    return <>{children}</>;
  }

  // 認証もトークンもない場合はnullを返す（リダイレクト処理は上で実行済み）
  return null;
};