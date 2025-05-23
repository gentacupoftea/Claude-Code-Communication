/**
 * OAuthリダイレクト処理ページ
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOAuthCallback } from '../hooks/useChannelConnection';
import oauthService from '../api/oauthService';
import { useAuth } from '../context/AuthContext';

interface StateData {
  channelType?: string;
  returnTo?: string;
  isLogin?: boolean;
}

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleOAuthCallback, loading, error } = useOAuthCallback();
  const { isAuthenticated } = useAuth();
  
  const [statusMessage, setStatusMessage] = useState('認証処理中...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const processOAuth = async () => {
      // URLからcodeとstateパラメータを取得
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      
      if (!code) {
        setErrorMessage('認証コードが見つかりません。認証が拒否されたか、エラーが発生しました。');
        return;
      }
      
      try {
        let stateData: StateData = {};
        
        // state JSONデータの解析
        if (state) {
          try {
            stateData = JSON.parse(state) as StateData;
          } catch (err) {
            console.error('Invalid state parameter:', err);
          }
        }
        
        // チャネル接続処理かログイン処理かを判断
        if (stateData.isLogin) {
          // OAuthログイン処理
          setStatusMessage('ログイン認証中...');
          
          await oauthService.authenticate({
            code,
            state: state || undefined,
            provider: stateData.channelType || 'unknown',
            redirectUri: `${window.location.origin}/oauth/callback`
          });
          
          // ログイン後のリダイレクト先
          const redirectTo = stateData.returnTo || '/dashboard';
          navigate(redirectTo, { replace: true });
        } else if (stateData.channelType) {
          // チャネル接続処理
          setStatusMessage(`${stateData.channelType}との接続を確立中...`);
          
          if (!isAuthenticated) {
            setErrorMessage('ログインが必要です。チャネル接続を行うにはログインしてください。');
            setTimeout(() => navigate('/login', { replace: true }), 3000);
            return;
          }
          
          // チャネル接続処理
          await handleOAuthCallback(code, state || '');
          
          // 接続後のリダイレクト先
          const redirectTo = stateData.returnTo || '/channels';
          navigate(redirectTo, { replace: true });
        } else {
          setErrorMessage('無効な認証リクエストです。チャネルタイプが指定されていません。');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setErrorMessage(
          err instanceof Error 
            ? err.message 
            : '認証処理中にエラーが発生しました。もう一度お試しください。'
        );
      }
    };
    
    processOAuth();
  }, [location, navigate, handleOAuthCallback, isAuthenticated]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">OAuth認証処理</h2>
          <p className="mt-2 text-sm text-gray-600">
            認証が完了するまでお待ちください。自動的にリダイレクトされます。
          </p>
        </div>
        
        <div className="mt-8">
          {errorMessage || error ? (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    認証エラー
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorMessage || error?.message}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/channels')}
                      className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                    >
                      チャネル管理に戻る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 rounded-lg bg-white p-6 shadow">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-center text-lg font-medium text-gray-900">{statusMessage}</p>
              <p className="text-center text-sm text-gray-500">
                ブラウザを閉じたり更新したりしないでください。数秒後に自動的にリダイレクトされます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;