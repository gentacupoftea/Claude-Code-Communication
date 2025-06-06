/**
 * AuthManager - 認証状態を管理するシングルトンクラス
 * 認証の中央管理、永続化、リスナー機能を提供
 */
export class AuthManager {
  private static instance: AuthManager;
  private isAuthenticated: boolean = false;
  private listeners: Set<(authenticated: boolean) => void> = new Set();
  private isInitialized: boolean = false;

  private constructor() {
    // プライベートコンストラクタでシングルトンを保証
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * 初期化処理 - LocalStorageから認証状態を復元
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        const authToken = localStorage.getItem('authToken');
        console.log('[AuthManager] Initializing, token found:', !!authToken);
        
        if (authToken) {
          this.isAuthenticated = true;
          console.log('[AuthManager] Authentication restored from localStorage');
        }
      }
    } catch (error) {
      console.error('[AuthManager] Initialization error:', error);
    } finally {
      this.isInitialized = true;
      this.notifyListeners();
    }
  }

  /**
   * ログイン処理
   */
  public async login(email: string, _password: string): Promise<boolean> {
    try {
      // デモ用 - すべてのログインを成功させる
      console.log('[AuthManager] Login attempt for:', email);
      
      const token = 'demo-token-' + Date.now();
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
        console.log('[AuthManager] Token saved to localStorage');
      }
      
      this.isAuthenticated = true;
      console.log('[AuthManager] Login successful, notifying listeners');
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('[AuthManager] Login error:', error);
      return false;
    }
  }

  /**
   * ログアウト処理
   */
  public logout(): void {
    console.log('[AuthManager] Logout initiated');
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      console.log('[AuthManager] Token removed from localStorage');
    }
    
    this.isAuthenticated = false;
    this.notifyListeners();
    console.log('[AuthManager] Logout completed');
  }

  /**
   * 現在の認証状態を取得
   */
  public getAuthState(): boolean {
    return this.isAuthenticated;
  }

  /**
   * 初期化状態を取得
   */
  public getInitializationState(): boolean {
    return this.isInitialized;
  }

  /**
   * トークンの存在確認
   */
  public hasValidToken(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      return !!token;
    } catch (error) {
      console.error('[AuthManager] Token check error:', error);
      return false;
    }
  }

  /**
   * 認証状態変更リスナーを追加
   */
  public addListener(listener: (authenticated: boolean) => void): void {
    this.listeners.add(listener);
    console.log('[AuthManager] Listener added, total listeners:', this.listeners.size);
  }

  /**
   * 認証状態変更リスナーを削除
   */
  public removeListener(listener: (authenticated: boolean) => void): void {
    this.listeners.delete(listener);
    console.log('[AuthManager] Listener removed, total listeners:', this.listeners.size);
  }

  /**
   * すべてのリスナーに変更を通知
   */
  private notifyListeners(): void {
    console.log('[AuthManager] Notifying', this.listeners.size, 'listeners of auth state:', this.isAuthenticated);
    this.listeners.forEach(listener => {
      try {
        listener(this.isAuthenticated);
      } catch (error) {
        console.error('[AuthManager] Error in listener callback:', error);
      }
    });
  }
}

// デフォルトエクスポートとしてインスタンスを提供
export const authManager = AuthManager.getInstance();