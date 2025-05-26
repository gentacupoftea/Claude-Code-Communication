/**
 * 認証済みルートを保護するコンポーネント
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean; // true: 認証が必要, false: 非認証用ルート（ログイン済みならリダイレクト）
  requiredPermissions?: string[]; // 必要な権限（配列）
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  requiredPermissions = []
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAuthenticated = !!user;

  // ローディング中
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress />
        <Box sx={{ color: 'text.secondary' }}>読み込み中...</Box>
      </Box>
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

  // 条件を満たす場合はコンテンツを表示
  return <>{children}</>;
};

export default AuthGuard;