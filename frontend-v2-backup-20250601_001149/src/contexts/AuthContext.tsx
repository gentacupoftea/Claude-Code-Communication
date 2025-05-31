'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  useEffect(() => {
    console.log('[AuthContext] Setting up AuthManager integration');
    
    // AuthManagerからの状態変更を監視
    const handleAuthChange = (authenticated: boolean) => {
      console.log('[AuthContext] Auth state changed:', authenticated);
      setIsAuthenticated(authenticated);
    };

    // リスナーを追加
    authManager.addListener(handleAuthChange);

    // AuthManagerを初期化
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing AuthManager');
      await authManager.initialize();
      
      // 初期状態を設定
      setIsAuthenticated(authManager.getAuthState());
      setIsInitialized(authManager.getInitializationState());
      setIsLoading(false);
      
      console.log('[AuthContext] Initialization complete, auth state:', authManager.getAuthState());
    };

    initializeAuth();

    // クリーンアップ
    return () => {
      console.log('[AuthContext] Cleaning up AuthManager listener');
      authManager.removeListener(handleAuthChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('[AuthContext] Login attempt');
    return await authManager.login(email, password);
  };

  const logout = () => {
    console.log('[AuthContext] Logout initiated');
    authManager.logout();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, isInitialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};