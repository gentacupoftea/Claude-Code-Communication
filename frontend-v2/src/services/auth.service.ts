// 認証サービスのモックアップ実装

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

class AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;

  constructor() {
    // ローカルストレージから認証情報を復元
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('authToken');
      const savedUser = localStorage.getItem('authUser');
      
      if (savedToken && savedUser) {
        this.token = savedToken;
        this.currentUser = JSON.parse(savedUser);
      }
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // TODO: 実際のAPIエンドポイントに接続
    console.log('Login attempt:', credentials);
    
    // モックレスポンス
    const mockUser: User = {
      id: '1',
      email: credentials.email,
      name: 'Test User',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    this.currentUser = mockUser;
    this.token = mockToken;
    
    // ローカルストレージに保存
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('authUser', JSON.stringify(mockUser));
    }
    
    return { user: mockUser, token: mockToken };
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    // TODO: 実際のAPIエンドポイントに接続
    console.log('Register attempt:', data);
    
    // モックレスポンス
    const mockUser: User = {
      id: '1',
      email: data.email,
      name: data.name || 'New User',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    this.currentUser = mockUser;
    this.token = mockToken;
    
    // ローカルストレージに保存
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('authUser', JSON.stringify(mockUser));
    }
    
    return { user: mockUser, token: mockToken };
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.token = null;
    
    // ローカルストレージをクリア
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    // TODO: 実際のAPIエンドポイントに接続してトークンを検証
    return this.currentUser;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.currentUser;
  }

  async updateUser(userData: Partial<User>): Promise<User> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }
    
    // TODO: 実際のAPIエンドポイントに接続
    this.currentUser = { ...this.currentUser, ...userData };
    
    // ローカルストレージを更新
    if (typeof window !== 'undefined') {
      localStorage.setItem('authUser', JSON.stringify(this.currentUser));
    }
    
    return this.currentUser;
  }
}

// シングルトンインスタンスをエクスポート
export const authService = new AuthService();