export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

class AuthService {
  private baseURL: string;
  private tokenKey = 'authToken';

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.staging.conea.ai';
  }

  initializeAuth(): void {
    // 認証初期化処理
  }

  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.tokenKey);
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    // デモ用の認証処理
    const token = `demo-token-${Date.now()}`;
    const user: User = {
      id: '1',
      email: request.email,
      name: 'Demo User'
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }

    return { token, user };
  }

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
    }
  }

  async getProfile(): Promise<User> {
    // デモ用のプロフィール取得
    return {
      id: '1',
      email: 'demo@example.com',
      name: 'Demo User'
    };
  }
}

export const authService = new AuthService();