/**
 * ページコンポーネントのエクスポート
 * 
 * このファイルでは、アプリケーションの各ページコンポーネントを
 * 一括でエクスポートし、アプリケーション全体での一貫したインポートを
 * 提供します。
 */

// 認証関連ページ
export { default as LoginPage } from './LoginPage';
export { default as SignupPage } from './SignupPage';
export { default as OAuthCallback } from './OAuthCallback';

// ダッシュボードとメインページ
export { default as Dashboard } from './Dashboard/Dashboard';
export { default as DashboardPage } from './DashboardPage';
export { default as OrdersPage } from './OrdersPage';
export { default as AnalyticsDashboard } from './AnalyticsDashboard';

// 設定とプロフィール
export { Settings } from './Settings/Settings';
export { Profile } from './Profile/Profile';
export { ProfileEdit } from './Profile/ProfileEdit';

// 分析と可視化
export { ApiSettings } from './ApiSettings/ApiSettings';
export { ChatAnalysis } from './ChatAnalysis/ChatAnalysis';
export { DashboardEditor } from './DashboardEditor/DashboardEditor';
export { SavedDashboards } from './SavedDashboards/SavedDashboards';
export { Reports } from './Reports/Reports';

// 顧客と通知
export { Customers } from './Customers/Customers';
export { Notifications } from './Notifications/Notifications';

// マーケティングとランディング
export { LandingPage } from './LandingPage/LandingPage';

/**
 * ページのメタ情報
 * ページタイトル、説明、必要な権限などの情報を提供
 */
export const pageMetadata = {
  dashboard: {
    title: 'ダッシュボード',
    description: '販売とパフォーマンスの主要指標を表示',
    requiredPermission: 'dashboard:view',
    icon: 'dashboard'
  },
  orders: {
    title: '注文管理',
    description: '注文履歴の表示と管理',
    requiredPermission: 'orders:view',
    icon: 'shopping_cart'
  },
  customers: {
    title: '顧客管理',
    description: '顧客情報の表示と管理',
    requiredPermission: 'customers:view',
    icon: 'people'
  },
  analytics: {
    title: '分析',
    description: '販売と顧客の詳細分析',
    requiredPermission: 'analytics:view',
    icon: 'bar_chart'
  },
  apiSettings: {
    title: 'API設定',
    description: 'API接続の設定と管理',
    requiredPermission: 'settings:edit',
    icon: 'settings_applications'
  },
  chat: {
    title: 'チャット分析',
    description: 'AIを活用した会話分析',
    requiredPermission: 'analytics:view',
    icon: 'chat'
  },
  dashboardEditor: {
    title: 'ダッシュボードエディタ',
    description: 'カスタムダッシュボードの作成と編集',
    requiredPermission: 'dashboards:edit',
    icon: 'edit'
  },
  savedDashboards: {
    title: '保存済みダッシュボード',
    description: '作成したダッシュボードの管理',
    requiredPermission: 'dashboards:view',
    icon: 'dashboard_customize'
  },
  reports: {
    title: 'レポート',
    description: 'カスタムレポートの作成と表示',
    requiredPermission: 'reports:view',
    icon: 'summarize'
  },
  settings: {
    title: '設定',
    description: 'アプリケーション設定の管理',
    requiredPermission: 'settings:view',
    icon: 'settings'
  },
  profile: {
    title: 'プロフィール',
    description: 'ユーザープロフィールの表示',
    requiredPermission: 'profile:view',
    icon: 'person'
  },
  notifications: {
    title: '通知',
    description: 'システム通知とアラートの管理',
    requiredPermission: 'notifications:view',
    icon: 'notifications'
  }
};