import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, SignupData, AuthTokens, AuthContextType, AuthState } from '../types/auth';
import authService from '../services/auth';

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const tokens = authService.getStoredTokens();
        if (tokens) {
          const user = await authService.getCurrentUser();
          setState({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        authService.clearTokens();
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { user, tokens } = await authService.login(credentials);
      setState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || error.message || 'Login failed',
      }));
      throw error;
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.signup(data);
      // After signup, automatically login
      await login({ email: data.email, password: data.password });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || 'Signup failed',
      }));
      throw error;
    }
  }, [login]);

  const logout = useCallback(() => {
    authService.logout();
    setState(initialState);
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const tokens = await authService.refreshToken();
      setState((prev) => ({ ...prev, tokens }));
    } catch (error) {
      logout();
      throw error;
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    refreshToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};