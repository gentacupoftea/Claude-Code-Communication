import api from './api';
import { User, LoginCredentials, SignupData, AuthTokens } from '../types/auth';

class AuthService {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // The auth API expects form data for OAuth2PasswordRequestForm
      const formData = new URLSearchParams();
      formData.append('username', credentials.email);
      formData.append('password', credentials.password);

      console.log('Attempting login with:', { email: credentials.email });
      console.log('Login URL:', '/api/v1/auth/login');

      // Get tokens
      const tokenResponse = await api.post<AuthTokens>('/api/v1/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('Login response:', tokenResponse);

      // Store tokens (this is important for the interceptor to work)
      this.storeTokens(tokenResponse);
      
      // Small delay to ensure localStorage is updated
      await new Promise(resolve => setTimeout(resolve, 10));

      console.log('Fetching user profile...');
      
      // Get user profile (the interceptor will add the Authorization header)
      const userResponse = await api.get<User>('/api/v1/auth/me');
      
      console.log('User profile response:', userResponse);

      return {
        user: userResponse,
        tokens: tokenResponse,
      };
    } catch (error: any) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      throw error;
    }
  }

  async signup(data: SignupData): Promise<User> {
    const response = await api.post<User>('/api/v1/auth/register', data);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/api/v1/auth/me');
    return response;
  }

  async refreshToken(): Promise<AuthTokens> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await api.post<AuthTokens>('/api/v1/auth/refresh', {
      refresh_token: tokens.refresh_token,
    });

    this.storeTokens(response);
    return response;
  }

  logout() {
    this.clearTokens();
    // Additional cleanup if needed
  }

  // Token management
  storeTokens(tokens: AuthTokens) {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  getStoredTokens(): AuthTokens | null {
    const tokensJson = localStorage.getItem('auth_tokens');
    return tokensJson ? JSON.parse(tokensJson) : null;
  }

  clearTokens() {
    localStorage.removeItem('auth_tokens');
  }

  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens();
    return !!tokens?.access_token;
  }
}

export default new AuthService();