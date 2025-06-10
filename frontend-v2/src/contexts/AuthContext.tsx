'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '@/src/services/auth.service';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        // authServiceはシングルトンで、コンストラクタでlocalStorageから復元される
        const storedToken = authService.getToken();
        if (storedToken) {
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            setToken(storedToken);
          } else {
            // トークンはあるがユーザーが取得できない場合はログアウトさせる
            await authService.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // エラー時もログアウト状態にする
        setUser(null);
        setToken(null);
        await authService.logout();
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  const login = async (credentials: any) => {
    setLoading(true);
    try {
      const { user: loggedInUser, token: authToken } = await authService.login(credentials);
      setUser(loggedInUser);
      setToken(authToken);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // UI側でエラーをハンドリングできるように再スロー
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setToken(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};