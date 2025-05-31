import { apiClient, API_CONFIG } from '@/src/lib/api-config';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        API_CONFIG.ENDPOINTS.AUTH.LOGIN,
        credentials
      );
      
      // トークンを保存
      if (response.token) {
        localStorage.setItem('authToken', response.token);
        apiClient.setAuthToken(response.token);
      }
      
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      apiClient.setAuthToken(null);
    }
  }

  public async getProfile(): Promise<User> {
    return apiClient.get<User>(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
  }

  public async refreshToken(): Promise<string> {
    const response = await apiClient.post<{ token: string }>(
      API_CONFIG.ENDPOINTS.AUTH.REFRESH
    );
    
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      apiClient.setAuthToken(response.token);
    }
    
    return response.token;
  }

  public getStoredToken(): string | null {
    return localStorage.getItem('authToken');
  }

  public initializeAuth(): void {
    const token = this.getStoredToken();
    if (token) {
      apiClient.setAuthToken(token);
    }
  }
}

export const authService = AuthService.getInstance();