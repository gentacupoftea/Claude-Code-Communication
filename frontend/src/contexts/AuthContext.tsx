import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService from '../services/authService';
import { ConnectionStatus } from '../services/connectionService';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
  lastLogin?: Date;
  avatar?: string;
  settings?: Record<string, any>;
}

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
          
          // Verify token is still valid by fetching current user
          try {
            await getProfileHandler();
          } catch (error) {
            // If token validation fails, clear auth state
            console.error('Failed to validate token', error);
            clearAuthState();
          }
        } else {
          // For development environment only
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_AUTH === 'true') {
            setUser({
              id: '1',
              email: 'test@example.com',
              name: 'Test User',
              role: 'admin',
              permissions: ['read:all', 'write:all', 'admin:all']
            });
          } else {
            clearAuthState();
          }
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
    setUser(userData);
    
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
      const response = await authService.login(credentials.email, credentials.password);
      
      // Make sure we have all required data
      if (!response.token || !response.refreshToken || !response.user) {
        throw new Error('Invalid server response');
      }
      
      // Save auth state
      saveAuthState(
        response.token,
        response.refreshToken,
        3600, // Default 1 hour
        response.user
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
      const response = await authService.register({
        email: data.email,
        password: data.password,
        name: data.name || '',
      });
      
      // Registration in our service automatically logs the user in
      if (response.token && response.refreshToken && response.user) {
        saveAuthState(
          response.token,
          response.refreshToken,
          3600,
          response.user
        );
      } else {
        // If the API doesn't log in automatically, do it manually
        await login({ email: data.email, password: data.password });
      }
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
      const apiUser = await authService.getCurrentUser() as any;
      const userData = apiUser;
      setUser(userData);
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