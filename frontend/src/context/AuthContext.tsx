/**
 * 認証状態をアプリ全体で管理するコンテキスト
 */
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import authService from '../services/authService';
import oauthService, { OAuthCredentials } from '../api/oauthService';
import { User, AuthTokens, AuthContextType, LoginCredentials, SignupData } from '../types/auth';

// トークンの保存と取得
const saveTokensToStorage = (tokens: AuthTokens) => {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens));
};

const getTokensFromStorage = (): AuthTokens | null => {
  const tokens = localStorage.getItem('auth_tokens');
  return tokens ? JSON.parse(tokens) : null;
};

const saveUserToStorage = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user));
};

const getUserFromStorage = (): User | null => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// 初期認証状態
const initialState: AuthContextType = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refreshToken: async () => {},
  clearError: () => {},
};

// 認証コンテキスト作成
export const AuthContext = createContext<AuthContextType>(initialState);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getUserFromStorage());
  const [tokens, setTokens] = useState<AuthTokens | null>(getTokensFromStorage());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // トークンの有効期限をチェック
  const isTokenExpired = useCallback((): boolean => {
    if (!tokens) return true;
    
    try {
      // JWTのペイロード部分を取得してデコード
      const base64Url = tokens.access_token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      // expフィールド（有効期限）を確認
      const expirationTime = payload.exp * 1000; // ミリ秒に変換
      return Date.now() >= expirationTime;
    } catch (e) {
      console.error('Token validation error:', e);
      return true;
    }
  }, [tokens]);

  // ユーザー情報取得
  const fetchCurrentUser = useCallback(async (): Promise<void> => {
    if (!tokens || isTokenExpired()) return;
    
    try {
      const apiUser = await authService.getCurrentUser() as any;
      const userData: User = {
        id: apiUser.id,
        email: apiUser.email,
        full_name: apiUser.full_name,
        is_active: apiUser.is_active,
        is_superuser: apiUser.is_superuser,
        created_at: apiUser.created_at
      };
      setUser(userData);
      saveUserToStorage(userData);
    } catch (error) {
      console.error('Error fetching current user:', error);
      // 認証エラーまたはトークン無効の場合はログアウト
      logout();
    }
  }, [tokens, isTokenExpired]);

  // 初期化
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      try {
        if (tokens && !isTokenExpired()) {
          // 保存されたトークンが有効な場合、ユーザー情報を取得
          await fetchCurrentUser();
        } else if (tokens) {
          // トークンが期限切れの場合、リフレッシュを試みる
          await refreshToken();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // エラーが発生した場合、認証状態をクリア
        logout();
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, [fetchCurrentUser, isTokenExpired, tokens]);

  // ログイン
  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.login(credentials.email, credentials.password);
      
      const authTokens: AuthTokens = {
        access_token: response.token,
        refresh_token: response.refreshToken,
        token_type: 'Bearer'
      };
      setTokens(authTokens);
      saveTokensToStorage(authTokens);
      
      // ユーザー情報を取得
      await fetchCurrentUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ログインに失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 新規登録
  const signup = async (data: SignupData): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.register({
        email: data.email,
        password: data.password,
        name: data.fullName || '',
      });
      
      const authTokens: AuthTokens = {
        access_token: response.token,
        refresh_token: response.refreshToken,
        token_type: 'Bearer'
      };
      setTokens(authTokens);
      saveTokensToStorage(authTokens);
      
      // ユーザー情報を取得
      await fetchCurrentUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : '登録に失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // ログアウト
  const logout = useCallback(() => {
    // APIログアウト
    authService.logout().catch(err => {
      console.error('Logout API error:', err);
    });
    
    // ローカルの認証状態をクリア
    setUser(null);
    setTokens(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('user');
  }, []);

  // トークンリフレッシュ
  const refreshToken = async (): Promise<void> => {
    if (!tokens?.refresh_token) return;
    
    try {
      const response = await authService.refreshToken(tokens.refresh_token);
      const authTokens: AuthTokens = {
        access_token: response.token,
        refresh_token: response.refreshToken,
        token_type: 'Bearer'
      };
      setTokens(authTokens);
      saveTokensToStorage(authTokens);
      
      // リフレッシュ成功後に現在のユーザー情報を取得
      await fetchCurrentUser();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // リフレッシュに失敗した場合はログアウト
      logout();
    }
  };

  // OAuthログイン
  const oauthLogin = async (credentials: OAuthCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { user: userData, tokens: authTokens } = await oauthService.authenticate(credentials);
      
      setUser(userData);
      setTokens(authTokens);
      saveUserToStorage(userData);
      saveTokensToStorage(authTokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuthログインに失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // エラークリア
  const clearError = () => {
    setError(null);
  };

  // 認証状態の計算
  const isAuthenticated = !!user && !!tokens && !isTokenExpired();

  // コンテキスト値
  const contextValue: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth フック
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;