/**
 * ログインフォームコンポーネント
 */
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import oauthService, { OAuthProvider } from '../../api/oauthService';

interface LocationState {
  from?: string;
}

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  
  // リダイレクト先（ログイン前にアクセスしようとしていたページ、または /dashboard）
  const from = state?.from || '/dashboard';

  // OAuth認証プロバイダーの取得
  React.useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providers = await oauthService.getProviders();
        setOauthProviders(providers.filter(provider => provider.isEnabled));
      } catch (error) {
        console.error('Failed to fetch OAuth providers:', error);
      }
    };
    
    fetchProviders();
  }, []);

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();
    
    // 入力検証
    if (!email.trim() || !password.trim()) {
      setFormError('メールアドレスとパスワードを入力してください');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('ログインに失敗しました。再度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // OAuth認証リンクの生成
  const handleOAuthLogin = async (provider: string) => {
    try {
      // OAuth認証URLの取得
      const redirectUri = `${window.location.origin}/auth/callback`;
      const authUrl = await oauthService.getAuthorizationUrl(
        provider,
        redirectUri,
        // リダイレクト先情報を含める
        JSON.stringify({ redirectTo: from })
      );
      
      // 認証ページへリダイレクト
      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth authorization error:', error);
      setFormError('OAuth認証の開始に失敗しました');
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Coneaにログイン</h2>
        <p className="text-sm text-gray-600">
          アカウント情報を入力してログインしてください
        </p>
      </div>

      {/* エラーメッセージ */}
      {(formError || authError) && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {formError || authError}
        </div>
      )}

      {/* ログインフォーム */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            placeholder="メールアドレスを入力"
            required
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <Link to="/reset-password" className="text-xs font-medium text-primary-600 hover:text-primary-500">
              パスワードをお忘れですか？
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              placeholder="パスワードを入力"
              required
            />
            <button
              type="button"
              className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              ログイン状態を保持
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-70"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center space-x-2">
              <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>認証中...</span>
            </div>
          ) : (
            "ログイン"
          )}
        </button>
      </form>

      {/* OAuth認証 */}
      {oauthProviders.length > 0 && (
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">または</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {oauthProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleOAuthLogin(provider.type)}
                className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <img src={provider.icon} alt={provider.name} className="mr-2 h-5 w-5" />
                <span>{provider.name}でログイン</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* アカウント登録リンク */}
      <div className="mt-6 text-center text-sm">
        <span className="text-gray-600">アカウントをお持ちでないですか？</span>
        <Link to="/signup" className="ml-1 font-medium text-primary-600 hover:text-primary-500">
          新規登録
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;