import React from 'react';
import { Route, Navigate, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import DashboardLayout from '../components/layout/DashboardLayout';

// 認証が不要なページ
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import { LandingPage } from '../pages/LandingPage/LandingPage';
import OAuthCallback from '../pages/OAuthCallback';

// 認証が必要なページ
import Dashboard from '../pages/Dashboard/Dashboard';
import OrdersPage from '../pages/OrdersPage';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';
import { ApiSettings } from '../pages/ApiSettings/ApiSettings';
import { ChatAnalysis } from '../pages/ChatAnalysis/ChatAnalysis';
import { DashboardEditor } from '../pages/DashboardEditor/DashboardEditor';
import { SavedDashboards } from '../pages/SavedDashboards/SavedDashboards';
import { Reports } from '../pages/Reports/Reports';
import { EnhancedReports } from '../pages/Reports/EnhancedReports';
import { Settings } from '../pages/Settings/Settings';
import { Customers } from '../pages/Customers/Customers';
import { Profile } from '../pages/Profile/Profile';
import { ProfileEdit } from '../pages/Profile/ProfileEdit';
import { Notifications } from '../pages/Notifications/Notifications';
import DataComponentsDemo from '../pages/Demo/DataComponentsDemo';

// 環境設定
import { currentEnvironment } from '../config/environments';

// エラーハンドリングサービス
import { trackPageView } from '../services/analyticsService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

/**
 * アプリケーションのルート定義
 * 
 * 環境に応じて異なる設定を適用できるようにする
 */
const AppRoutes: React.FC = () => {
  // ページビューのトラッキング（環境に応じて有効/無効）
  React.useEffect(() => {
    if (currentEnvironment === 'production') {
      // ページビューのトラッキングを設定（ルート変更時に実行）
      const trackCurrentPage = () => {
        const path = window.location.pathname;
        trackPageView(path);
      };
      
      // 初回ロード時にトラッキング
      trackCurrentPage();
      
      // HistoryAPIの変更をリッスン（SPA内の遷移をトラック）
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        originalPushState.apply(window.history, args);
        trackCurrentPage();
      };
      
      // クリーンアップ関数
      return () => {
        window.history.pushState = originalPushState;
      };
    }
  }, []);

  // デバッグモードで追加情報を表示
  React.useEffect(() => {
    if (currentEnvironment === 'development') {
      console.log(`Running in ${currentEnvironment} mode`);
    }
  }, []);

  return (
    <ErrorBoundary>
      <Routes>
        {/* 公開ルート */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        
        {/* 保護されたルート */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/api-settings" element={<ApiSettings />} />
            <Route path="/chat" element={<ChatAnalysis />} />
            <Route path="/dashboard-editor" element={<DashboardEditor />} />
            <Route path="/dashboard-editor/:id" element={<DashboardEditor />} />
            <Route path="/saved-dashboards" element={<SavedDashboards />} />
            <Route path="/reports" element={<EnhancedReports />} />
            <Route path="/reports/legacy" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<ProfileEdit />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/demo/data-components" element={<DataComponentsDemo />} />
          </Route>
        </Route>
        
        {/* その他すべてのルートはルートページにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default AppRoutes;