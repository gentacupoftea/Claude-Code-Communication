# React AuthContext 実装パターン（Worker A-4成果物）

## 🔐 型安全なAuthContext実装

### 1. 基本型定義

```typescript
// src/types/auth.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'president' | 'worker' | 'user' | 'guest';
  picture?: string;
  permissions: string[];
  authMethod: 'password' | 'google' | 'magic-link';
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithMagicLink: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}
```

### 2. AuthContext実装

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { AuthState, AuthContextType, User } from '../types/auth';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

// 初期状態
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null
};

// アクション型定義
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_USER' }
  | { type: 'CLEAR_ERROR' };

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { 
        ...state, 
        isAuthenticated: true, 
        user: action.payload, 
        error: null,
        isLoading: false 
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload, 
        isLoading: false,
        isAuthenticated: false,
        user: null
      };
    case 'CLEAR_USER':
      return { 
        ...state, 
        isAuthenticated: false, 
        user: null, 
        isLoading: false 
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// Context作成
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// カスタムフック
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 3. AuthProvider実装

```typescript
// AuthProvider コンポーネント
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ✅ 修正: useEffectでのasync処理を適切に処理
  const initializeAuth = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // トークンの存在確認
      const token = authService.getStoredToken();
      if (!token) {
        dispatch({ type: 'CLEAR_USER' });
        return;
      }

      // プロフィール取得
      const profile = await authService.getProfile();
      if (profile) {
        dispatch({ type: 'SET_USER', payload: profile });
      } else {
        // 無効なトークンの場合はクリア
        await authService.logout();
        dispatch({ type: 'CLEAR_USER' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '認証初期化エラー';
      logger.error('Auth initialization error:', errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      // エラー時はトークンをクリア
      await authService.logout();
    }
  }, []);

  // ✅ useEffectでの適切なasync処理
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // ログイン関数
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await authService.login({ email, password });
      
      if (response?.user) {
        dispatch({ type: 'SET_USER', payload: response.user });
        return true;
      }
      
      dispatch({ type: 'SET_ERROR', payload: 'ログインに失敗しました' });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログインエラー';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  }, []);

  // Google認証
  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await authService.loginWithGoogle();
      
      if (response?.user) {
        dispatch({ type: 'SET_USER', payload: response.user });
        return true;
      }
      
      dispatch({ type: 'SET_ERROR', payload: 'Google認証に失敗しました' });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google認証エラー';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  }, []);

  // マジックリンク認証（簡易版）
  const loginWithMagicLink = useCallback(async (email: string): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      // 簡易マジックリンク（実際のメール送信なし）
      const magicToken = await authService.generateMagicLink(email);
      
      if (magicToken) {
        // デモ用: 即座にログイン完了とする
        const user: User = {
          id: 'magic-' + Date.now(),
          email,
          name: email.split('@')[0] || 'User',
          role: 'user',
          permissions: ['read'],
          authMethod: 'magic-link'
        };
        
        dispatch({ type: 'SET_USER', payload: user });
        return true;
      }
      
      dispatch({ type: 'SET_ERROR', payload: 'マジックリンク生成に失敗しました' });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'マジックリンクエラー';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  }, []);

  // ログアウト
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
      dispatch({ type: 'CLEAR_USER' });
    } catch (error) {
      logger.error('Logout error:', error);
      // エラーでもローカル状態はクリア
      dispatch({ type: 'CLEAR_USER' });
    }
  }, []);

  // 認証状態更新
  const refreshAuth = useCallback(async (): Promise<void> => {
    await initializeAuth();
  }, [initializeAuth]);

  // エラークリア
  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const contextValue: AuthContextType = {
    ...state,
    login,
    loginWithGoogle,
    loginWithMagicLink,
    logout,
    refreshAuth,
    clearError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 4. ErrorBoundary実装

```typescript
// src/components/AuthErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('AuthErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              認証エラーが発生しました
            </h1>
            <p className="text-gray-600 mb-6">
              ページを再読み込みしてください
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 5. 使用例

```typescript
// src/App.tsx
import React from 'react';
import { AuthProvider, AuthErrorBoundary } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <LoginPage />;
};

export const App: React.FC = () => {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AuthErrorBoundary>
  );
};
```

### 6. ProtectedRoute コンポーネント

```typescript
// src/components/ProtectedRoute.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../pages/LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // 役割チェック
  if (requiredRole && user.role !== requiredRole) {
    return <div>アクセス権限がありません</div>;
  }

  // 権限チェック
  if (requiredPermission && !user.permissions.includes(requiredPermission)) {
    return <div>必要な権限がありません</div>;
  }

  return <>{children}</>;
};
```

## 🎯 実装のポイント

1. **useReducer使用**: 複雑な状態管理を型安全に実装
2. **適切なエラーハンドリング**: ErrorBoundaryで予期せぬエラーをキャッチ
3. **非同期処理の適切な処理**: useEffectでのasync関数の適切な実装
4. **型安全性**: TypeScriptの型システムを最大限活用
5. **再利用性**: コンポーネントの分離と抽象化

このパターンにより、堅牢で型安全なReact認証システムを構築できます。