'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authManager } from '@/src/lib/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('[AuthContext] Setting up AuthManager integration');
    
    // AuthManagerからの状態変更を監視
    const handleAuthChange = (authenticated: boolean) => {
      console.log('[AuthContext] Auth state changed:', authenticated);
      setIsAuthenticated(authenticated);
      
      // ログアウト時のリダイレクト処理
      if (!authenticated && pathname !== '/login' && pathname !== '/') {
        console.log('[AuthContext] User logged out, redirecting to login');
        router.replace('/login');
      }
    };

    // リスナーを追加
    authManager.addListener(handleAuthChange);

    // AuthManagerを初期化
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing AuthManager');
      await authManager.initialize();
      
      // 初期状態を設定
      const currentAuthState = authManager.getAuthState();
      setIsAuthenticated(currentAuthState);
      setIsInitialized(authManager.getInitializationState());
      setIsLoading(false);
      
      console.log('[AuthContext] Initialization complete, auth state:', currentAuthState);
    };

    initializeAuth();

    // クリーンアップ
    return () => {
      console.log('[AuthContext] Cleaning up AuthManager listener');
      authManager.removeListener(handleAuthChange);
    };
  }, [router, pathname]);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('[AuthContext] Login attempt');
    setIsLoading(true);
    try {
      const success = await authManager.login(email, password);
      if (success) {
        // ログイン成功後、少し待ってからリダイレクト
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('[AuthContext] Logout initiated');
    authManager.logout();
    // リダイレクトはhandleAuthChangeで処理される
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, isInitialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};