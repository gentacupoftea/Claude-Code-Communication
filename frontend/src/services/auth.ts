import api from './api';
import { User, LoginCredentials, SignupData, AuthTokens } from '../types/auth';

class AuthService {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    // The auth API expects form data for OAuth2PasswordRequestForm
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    // Get tokens
    const tokenResponse = await api.post<AuthTokens>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Store tokens
    this.storeTokens(tokenResponse.data);

    // Get user profile
    const userResponse = await api.get<User>('/auth/me');

    return {
      user: userResponse.data,
      tokens: tokenResponse.data,
    };
  }

  async signup(data: SignupData): Promise<User> {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<AuthTokens> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post<AuthTokens>('/auth/refresh', {
      refresh_token: tokens.refreshToken,
    });

    this.storeTokens(response.data);
    return response.data;
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
    return !!tokens?.accessToken;
  }
}

export default new AuthService();