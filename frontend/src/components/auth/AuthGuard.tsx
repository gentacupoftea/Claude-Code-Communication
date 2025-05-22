/**
 * 認証済みルートを保護するコンポーネント
 */
import React, { useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/MockAuthContext';

interface AuthGuardProps {
  requireAuth?: boolean; // true: 認証が必要, false: 非認証用ルート（ログイン済みならリダイレクト）
  requiredPermissions?: string[]; // 必要な権限（配列）
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  requireAuth = true,
  requiredPermissions = []
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // ローディング中
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 認証チェック
  if (requireAuth && !isAuthenticated) {
    // 認証が必要なのに未認証の場合、ログインページへリダイレクト
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 非認証ルートチェック (ログインページなど）
  if (!requireAuth && isAuthenticated) {
    // 非認証ルートなのに認証済みの場合、ダッシュボードへリダイレクト
    return <Navigate to="/dashboard" replace />;
  }

  // 権限チェック
  if (
    requireAuth &&
    isAuthenticated && 
    user && 
    requiredPermissions.length > 0 && 
    !requiredPermissions.every(permission => user.permissions?.includes(permission))
  ) {
    // 必要な権限がない場合は403ページへ
    return <Navigate to="/forbidden" replace />;
  }

  // 条件を満たす場合はルートコンテンツを表示
  return <Outlet />;
};

export default AuthGuard;