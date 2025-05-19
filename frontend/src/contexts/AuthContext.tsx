import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
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
  logout: () => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    
    // Set a mock user for development
    setUser({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });
    
    setLoading(false);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    
    try {
      // This would make an API call to authenticate
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (data: { email: string; password: string; name?: string }) => {
    setError(null);
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Signup failed');
      }
      
      // Auto-login after successful signup
      await login({ email: data.email, password: data.password });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };
  
  const clearError = () => {
    setError(null);
  };

  const isAuthenticated = true; // Temporarily set to true for development
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