/**
 * 認証カスタムフック
 * React Queryを使用した認証状態管理、ログイン、ログアウト機能を提供
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { 
  login as loginService, 
  logout as logoutService, 
  getUserProfile, 
  checkAuthStatus,
  register as registerService,
  updateUserProfile as updateProfileService,
  updatePassword as updatePasswordService
} from '../api/authService';
import { 
  LoginRequest, 
  User, 
  RegisterRequest, 
  UpdatePasswordRequest
} from '../api/types';

// クエリキー定数
const AUTH_KEYS = {
  user: ['auth', 'user'],
  status: ['auth', 'status'],
};

export function useAuth() {
  const queryClient = useQueryClient();

  // 認証状態のチェック
  const { data: isAuthenticated = false, isLoading: isCheckingAuth } = useQuery({
    queryKey: AUTH_KEYS.status,
    queryFn: checkAuthStatus,
    staleTime: 1000 * 60 * 5, // 5分間のキャッシュ
  });

  // ユーザー情報の取得
  const { 
    data: user,
    isLoading: isLoadingUser,
    error: userError,
    refetch: refetchUser 
  } = useQuery({
    queryKey: AUTH_KEYS.user,
    queryFn: getUserProfile,
    enabled: isAuthenticated, // 認証済みの場合のみ実行
    staleTime: 1000 * 60 * 5, // 5分間のキャッシュ
  });

  // ログイン処理
  const { 
    mutateAsync: login,
    isPending: isLoggingIn,
    error: loginError 
  } = useMutation({
    mutationFn: (credentials: LoginRequest) => loginService(credentials),
    onSuccess: (userData: User) => {
      // 認証状態とユーザー情報を更新
      queryClient.setQueryData(AUTH_KEYS.status, true);
      queryClient.setQueryData(AUTH_KEYS.user, userData);
    },
  });

  // ログアウト処理
  const { 
    mutateAsync: logout,
    isPending: isLoggingOut 
  } = useMutation({
    mutationFn: logoutService,
    onSuccess: () => {
      // キャッシュをクリア
      queryClient.setQueryData(AUTH_KEYS.status, false);
      queryClient.setQueryData(AUTH_KEYS.user, null);
      queryClient.clear(); // 全てのクエリキャッシュをクリア
    },
  });

  // ユーザー登録処理
  const { 
    mutateAsync: register,
    isPending: isRegistering,
    error: registerError 
  } = useMutation({
    mutationFn: (data: RegisterRequest) => registerService(data),
    onSuccess: (userData: User) => {
      // 認証状態とユーザー情報を更新
      queryClient.setQueryData(AUTH_KEYS.status, true);
      queryClient.setQueryData(AUTH_KEYS.user, userData);
    },
  });

  // プロフィール更新処理
  const { 
    mutateAsync: updateProfile,
    isPending: isUpdatingProfile,
    error: updateProfileError 
  } = useMutation({
    mutationFn: (data: Partial<User>) => updateProfileService(data),
    onSuccess: (updatedUser: User) => {
      // ユーザー情報を更新
      queryClient.setQueryData(AUTH_KEYS.user, updatedUser);
    },
  });

  // パスワード更新処理
  const { 
    mutateAsync: updatePassword,
    isPending: isUpdatingPassword,
    error: updatePasswordError 
  } = useMutation({
    mutationFn: (data: UpdatePasswordRequest) => updatePasswordService(data),
  });

  // ユーザー情報の再取得
  const refreshUserData = useCallback(() => {
    if (isAuthenticated) {
      refetchUser();
    }
  }, [isAuthenticated, refetchUser]);

  // 認証エラーハンドリング
  useEffect(() => {
    const handleAuthError = (event: StorageEvent) => {
      if (event.key === 'conea_auth_token' && !event.newValue) {
        // ローカルストレージからトークンが削除された場合
        queryClient.setQueryData(AUTH_KEYS.status, false);
        queryClient.setQueryData(AUTH_KEYS.user, null);
      }
    };

    window.addEventListener('storage', handleAuthError);
    return () => {
      window.removeEventListener('storage', handleAuthError);
    };
  }, [queryClient]);

  return {
    // 状態
    isAuthenticated,
    user,
    isLoading: isCheckingAuth || isLoadingUser,
    isLoggingIn,
    isLoggingOut,
    isRegistering,
    isUpdatingProfile,
    isUpdatingPassword,
    
    // エラー
    loginError,
    registerError,
    updateProfileError,
    updatePasswordError,
    userError,
    
    // アクション
    login,
    logout,
    register,
    updateProfile,
    updatePassword,
    refreshUserData,
  };
}