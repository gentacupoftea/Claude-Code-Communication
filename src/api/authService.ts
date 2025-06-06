/**
 * 認証サービス
 * ログイン、ログアウト、トークン管理、ユーザー情報の取得などの認証関連処理
 */

import { API_CONFIG } from './config';
import { apiClient, ApiError } from './apiClient';
import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  RefreshTokenResponse, 
  RegisterRequest,
  UpdatePasswordRequest,
  ApiResponse,
  ErrorCode
} from './types';

// ローカルストレージキー
const {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  TOKEN_EXPIRY_KEY,
  REFRESH_THRESHOLD
} = API_CONFIG.AUTH;

// トークン保存
export const saveTokens = (
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    
    // 有効期限をUNIXタイムスタンプで保存
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  } catch (error) {
    console.error('Failed to save tokens to local storage:', error);
  }
};

// ユーザー情報の保存
export const saveUser = (user: User): void => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user to local storage:', error);
  }
};

// アクセストークンの取得
export const getAccessToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get access token from local storage:', error);
    return null;
  }
};

// リフレッシュトークンの取得
export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get refresh token from local storage:', error);
    return null;
  }
};

// ユーザー情報の取得
export const getUser = (): User | null => {
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Failed to get user from local storage:', error);
    return null;
  }
};

// トークン有効期限の確認
export const isTokenExpired = (): boolean => {
  try {
    const expiryTimeStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryTimeStr) return true;
    
    const expiryTime = parseInt(expiryTimeStr, 10);
    // 現在時刻と有効期限を比較
    return Date.now() >= expiryTime;
  } catch (error) {
    console.error('Failed to check token expiry:', error);
    return true;
  }
};

// トークン更新が必要かどうか確認
export const shouldRefreshToken = (): boolean => {
  try {
    const expiryTimeStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryTimeStr) return true;
    
    const expiryTime = parseInt(expiryTimeStr, 10);
    // 有効期限切れまでの残り時間がしきい値より小さい場合に更新
    return (expiryTime - Date.now()) / 1000 < REFRESH_THRESHOLD;
  } catch (error) {
    console.error('Failed to check token refresh necessity:', error);
    return false;
  }
};

// トークンとユーザー情報のクリア
export const clearAuthTokens = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (error) {
    console.error('Failed to clear auth tokens from local storage:', error);
  }
};

// ログイン処理
export const login = async (loginData: LoginRequest): Promise<User> => {
  try {
    const response = await apiClient.post<LoginResponse>(
      API_CONFIG.ENDPOINTS.AUTH.LOGIN,
      loginData,
      { skipAuthHeader: true, skipRefreshToken: true }
    );
    
    if (!response.success || !response.data) {
      throw new ApiError(
        response.message || 'ログインに失敗しました',
        ErrorCode.UNAUTHORIZED
      );
    }
    
    const { accessToken, refreshToken, expiresIn, user } = response.data;
    
    // トークンとユーザー情報を保存
    saveTokens(accessToken, refreshToken, expiresIn);
    saveUser(user);
    
    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('ログイン処理中にエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
  }
};

// トークンリフレッシュ処理
export const refreshAccessToken = async (): Promise<void> => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new ApiError('リフレッシュトークンがありません', ErrorCode.UNAUTHORIZED);
  }
  
  try {
    const response = await apiClient.post<RefreshTokenResponse>(
      API_CONFIG.ENDPOINTS.AUTH.REFRESH,
      { refreshToken },
      { skipAuthHeader: true, skipRefreshToken: true }
    );
    
    if (!response.success || !response.data) {
      throw new ApiError(
        response.message || 'トークンの更新に失敗しました',
        ErrorCode.UNAUTHORIZED
      );
    }
    
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
    
    // 新しいトークンを保存
    saveTokens(
      accessToken,
      newRefreshToken || refreshToken, // 新しいリフレッシュトークンがない場合は既存のものを使用
      expiresIn
    );
  } catch (error) {
    clearAuthTokens(); // エラー時は認証情報をクリア
    throw error;
  }
};

// ログアウト処理
export const logout = async (): Promise<void> => {
  try {
    // サーバー側でのログアウト処理
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, {});
  } catch (error) {
    console.error('Server logout failed:', error);
  } finally {
    // ローカルの認証情報をクリア
    clearAuthTokens();
  }
};

// ユーザー登録処理
export const register = async (registerData: RegisterRequest): Promise<User> => {
  try {
    const response = await apiClient.post<LoginResponse>(
      API_CONFIG.ENDPOINTS.AUTH.REGISTER,
      registerData,
      { skipAuthHeader: true, skipRefreshToken: true }
    );
    
    if (!response.success || !response.data) {
      throw new ApiError(
        response.message || 'ユーザー登録に失敗しました',
        ErrorCode.VALIDATION_ERROR
      );
    }
    
    const { accessToken, refreshToken, expiresIn, user } = response.data;
    
    // トークンとユーザー情報を保存
    saveTokens(accessToken, refreshToken, expiresIn);
    saveUser(user);
    
    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('ユーザー登録処理中にエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
  }
};

// ユーザープロフィール取得
export const getUserProfile = async (): Promise<User> => {
  try {
    const response = await apiClient.get<User>(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
    
    if (!response.success || !response.data) {
      throw new ApiError(
        response.message || 'プロフィールの取得に失敗しました',
        ErrorCode.NOT_FOUND
      );
    }
    
    // 最新のユーザー情報を保存
    saveUser(response.data);
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('プロフィール取得中にエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
  }
};

// ユーザープロフィール更新
export const updateUserProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    const response = await apiClient.put<User>(API_CONFIG.ENDPOINTS.AUTH.PROFILE, userData);
    
    if (!response.success || !response.data) {
      throw new ApiError(
        response.message || 'プロフィールの更新に失敗しました',
        ErrorCode.VALIDATION_ERROR
      );
    }
    
    // 更新されたユーザー情報を保存
    saveUser(response.data);
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('プロフィール更新中にエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
  }
};

// パスワード更新
export const updatePassword = async (passwordData: UpdatePasswordRequest): Promise<void> => {
  try {
    const response = await apiClient.post<void>(
      `${API_CONFIG.ENDPOINTS.AUTH.PROFILE}/password`,
      passwordData
    );
    
    if (!response.success) {
      throw new ApiError(
        response.message || 'パスワードの更新に失敗しました',
        ErrorCode.VALIDATION_ERROR
      );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('パスワード更新中にエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
  }
};

// 認証状態の確認
export const checkAuthStatus = async (): Promise<boolean> => {
  const token = getAccessToken();
  
  if (!token) {
    return false;
  }
  
  if (isTokenExpired()) {
    // トークンが期限切れの場合
    try {
      await refreshAccessToken();
      return true;
    } catch (_error) {
      // リフレッシュに失敗した場合
      clearAuthTokens();
      return false;
    }
  } else if (shouldRefreshToken()) {
    // 期限切れが近い場合はバックグラウンドでリフレッシュ
    refreshAccessToken().catch(error => {
      console.error('Background token refresh failed:', error);
      clearAuthTokens();
    });
  }
  
  return true;
};