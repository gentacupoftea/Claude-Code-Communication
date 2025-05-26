import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService from '../services/authService';
import { ConnectionStatus } from '../services/connectionService';
import { User } from '../types/auth';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signup: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  getProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setError: (error: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        const storedToken = localStorage.getItem('auth_access_token');
        const storedRefreshToken = localStorage.getItem('auth_refresh_token');
        const storedTokenExpiry = localStorage.getItem('auth_token_expiry');
        const storedUser = localStorage.getItem('auth_user');
        
        if (storedToken && storedRefreshToken && storedUser) {
          setToken(storedToken);
          setRefreshToken(storedRefreshToken);
          
          if (storedTokenExpiry) {
            setTokenExpiry(parseInt(storedTokenExpiry));
            
            // Check if token is expired and refresh if needed
            const now = Date.now();
            if (parseInt(storedTokenExpiry) < now) {
              await refreshTokenHandler();
            }
          }
          
          setUser(JSON.parse(storedUser));
        } else {
          // No stored auth data, user is not logged in
          console.log('🔍 AuthContext: 認証データなし - ログアウト状態');
          clearAuthState();
        }
      } catch (error) {
        console.error('Error initializing auth', error);
        clearAuthState();
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  // Helper function to clear auth state
  const clearAuthState = () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setTokenExpiry(null);
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_token_expiry');
    localStorage.removeItem('auth_user');
  };
  
  // Helper function to save auth state
  const saveAuthState = (
    accessToken: string, 
    refreshTokenValue: string, 
    expiresIn: number, 
    userData: User
  ) => {
    const expiry = Date.now() + expiresIn * 1000;
    setToken(accessToken);
    setRefreshToken(refreshTokenValue);
    setTokenExpiry(expiry);
    setUser(userData as User);
    
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshTokenValue);
    localStorage.setItem('auth_token_expiry', expiry.toString());
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };
  
  // Login handler
  const login = async (credentials: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    
    try {
      // For demo purposes, simulate successful login
      const mockUser: User = {
        id: '1',
        email: credentials.email,
        full_name: 'Demo User',
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        role: 'admin',
        permissions: ['read:all', 'write:all', 'admin:all']
      };
      
      // Save auth state
      saveAuthState(
        'demo-access-token',
        'demo-refresh-token',
        3600, // 1 hour
        mockUser
      );
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Signup handler
  const signup = async (data: { email: string; password: string; name?: string }) => {
    setError(null);
    setLoading(true);
    
    try {
      // For demo purposes, simulate successful signup and auto-login
      const mockUser: User = {
        id: '1',
        email: data.email,
        full_name: data.name || 'Demo User',
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        role: 'admin',
        permissions: ['read:all', 'write:all', 'admin:all']
      };
      
      saveAuthState(
        'demo-access-token',
        'demo-refresh-token',
        3600,
        mockUser
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      // Send logout request to server
      await authService.logout();
    } catch (error) {
      console.error('Error during logout', error);
    } finally {
      // Clear local state regardless of server response
      clearAuthState();
    }
  };

  // Update user data
  const updateUser = (updatedUser: User) => {
    if (!user) return;
    
    const newUser = { ...user, ...updatedUser };
    setUser(newUser);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  };
  
  // Error handling
  const clearError = () => {
    setError(null);
  };
  
  // Refresh token handler
  const refreshTokenHandler = async (): Promise<boolean> => {
    if (!refreshToken) return false;
    
    try {
      const response = await authService.refreshToken(refreshToken);
      
      if (response.token && response.refreshToken) {
        saveAuthState(
          response.token,
          response.refreshToken,
          3600,
          response.user || user as User
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed', error);
      clearAuthState();
      return false;
    }
  };
  
  // Get user profile
  const getProfileHandler = async (): Promise<void> => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData as User);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to fetch user profile', error);
      throw error;
    }
  };
  
  // Reset password
  const resetPasswordHandler = async (email: string): Promise<void> => {
    setError(null);
    setLoading(true);
    
    try {
      await authService.resetPassword(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  // Permission checking
  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    
    // Check for admin permission which grants all access
    if (user.permissions.includes('admin:all')) return true;
    
    return user.permissions.includes(permission);
  };
  
  // Role checking
  const hasRole = (role: string | string[]): boolean => {
    if (!user || !user.role) return false;
    
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  };

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;
  const isLoading = loading;

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
    updateUser,
    clearError,
    refreshToken: refreshTokenHandler,
    hasPermission,
    hasRole,
    getProfile: getProfileHandler,
    resetPassword: resetPasswordHandler,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// useAuth フックのエクスポート
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
export default AuthContext;