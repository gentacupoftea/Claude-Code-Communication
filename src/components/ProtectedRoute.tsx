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

  useEffect(() => {
    console.log('[ProtectedRoute] Auth state check:', { 
      isAuthenticated, 
      isLoading, 
      isInitialized,
      hasValidToken: authManager.hasValidToken()
    });
    
    if (isInitialized && !isLoading) {
      const hasToken = authManager.hasValidToken();
      
      if (!isAuthenticated && !hasToken) {
        console.log('[ProtectedRoute] No authentication, redirecting to login');
        router.push('/login');
        return;
      }
      
      console.log('[ProtectedRoute] Authentication check passed');
    }
  }, [isAuthenticated, isLoading, isInitialized, router]);

  // 初期化中またはロード中の場合はローディング画面を表示
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">ログイン確認中...</div>
      </div>
    );
  }

  // 認証状態またはトークンがある場合はコンテンツを表示
  if (isAuthenticated || authManager.hasValidToken()) {
    console.log('[ProtectedRoute] Rendering protected content');
    return <>{children}</>;
  }

  // 認証もトークンもない場合はリダイレクト待ち
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white">認証が必要です...</div>
    </div>
  );
};