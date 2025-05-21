import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OfflineProvider } from './contexts/OfflineContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import ThemeWrapper from './components/layout/ThemeWrapper';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard/Dashboard';
import OrdersPage from './pages/OrdersPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import { ApiSettings } from './pages/ApiSettings/ApiSettings';
import { ChatAnalysis } from './pages/ChatAnalysis/ChatAnalysis';
import { DashboardEditor } from './pages/DashboardEditor/DashboardEditor';
import { SavedDashboards } from './pages/SavedDashboards/SavedDashboards';
import { LandingPage } from './pages/LandingPage/LandingPage';
import { Reports } from './pages/Reports/Reports';
import { Settings } from './pages/Settings/Settings';
import { Customers } from './pages/Customers/Customers';
import { Profile } from './pages/Profile/Profile';
import { ProfileEdit } from './pages/Profile/ProfileEdit';
import { Notifications } from './pages/Notifications/Notifications';
import ServerConnectionPage from './pages/ServerConnection/ServerConnectionPage';
import { UserProfilePage } from './pages/User';
import { DebugDemoPage } from './pages/Debug/DebugDemoPage';
import { HelpSystemDemo } from './pages/Help/HelpSystemDemo';
import { ToastNotification } from './components/notifications';
import { SyncStatusBar } from './components/offline';
import { ErrorBoundary, DebugToolbar } from './components/debug';
import diagnosticsService from './services/diagnosticsService';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App: React.FC = () => {
  // 診断サービスの初期化
  useEffect(() => {
    diagnosticsService.initialize({
      logLevels: ['debug', 'info', 'warn', 'error'],
      enablePerformanceMonitoring: true,
      enableNetworkMonitoring: true
    });

    return () => {
      diagnosticsService.dispose();
    };
  }, []);

  return (
    <ErrorBoundary componentName="App">
      <Provider store={store}>
        <ThemeWrapper>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ConnectionProvider>
                <OfflineProvider>
                  <NotificationProvider>
                    <Router>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        
                        {/* Protected routes */}
                        <Route element={<ProtectedRoute />}>
                          <Route element={<DashboardLayout />}>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={
                              <ErrorBoundary componentName="Dashboard">
                                <Dashboard />
                              </ErrorBoundary>
                            } />
                            <Route path="/server-connection" element={
                              <ErrorBoundary componentName="ServerConnection">
                                <ServerConnectionPage />
                              </ErrorBoundary>
                            } />
                            <Route path="/orders" element={
                              <ErrorBoundary componentName="Orders">
                                <OrdersPage />
                              </ErrorBoundary>
                            } />
                            <Route path="/customers" element={
                              <ErrorBoundary componentName="Customers">
                                <Customers />
                              </ErrorBoundary>
                            } />
                            <Route path="/analytics" element={
                              <ErrorBoundary componentName="Analytics">
                                <AnalyticsDashboard />
                              </ErrorBoundary>
                            } />
                            <Route path="/api-settings" element={
                              <ErrorBoundary componentName="ApiSettings">
                                <ApiSettings />
                              </ErrorBoundary>
                            } />
                            <Route path="/chat" element={
                              <ErrorBoundary componentName="ChatAnalysis">
                                <ChatAnalysis />
                              </ErrorBoundary>
                            } />
                            <Route path="/dashboard-editor" element={
                              <ErrorBoundary componentName="DashboardEditor">
                                <DashboardEditor />
                              </ErrorBoundary>
                            } />
                            <Route path="/dashboard-editor/:id" element={
                              <ErrorBoundary componentName="DashboardEditorWithId">
                                <DashboardEditor />
                              </ErrorBoundary>
                            } />
                            <Route path="/saved-dashboards" element={
                              <ErrorBoundary componentName="SavedDashboards">
                                <SavedDashboards />
                              </ErrorBoundary>
                            } />
                            <Route path="/reports" element={
                              <ErrorBoundary componentName="Reports">
                                <Reports />
                              </ErrorBoundary>
                            } />
                            <Route path="/settings" element={
                              <ErrorBoundary componentName="Settings">
                                <Settings />
                              </ErrorBoundary>
                            } />
                            <Route path="/profile" element={
                              <ErrorBoundary componentName="UserProfile">
                                <UserProfilePage />
                              </ErrorBoundary>
                            } />
                            <Route path="/profile/edit" element={
                              <ErrorBoundary componentName="ProfileEdit">
                                <ProfileEdit />
                              </ErrorBoundary>
                            } />
                            <Route path="/notifications" element={
                              <ErrorBoundary componentName="Notifications">
                                <Notifications />
                              </ErrorBoundary>
                            } />
                            <Route path="/debug" element={
                              <ErrorBoundary componentName="DebugDemo">
                                <DebugDemoPage />
                              </ErrorBoundary>
                            } />
                            <Route path="/help" element={
                              <ErrorBoundary componentName="HelpSystem">
                                <HelpSystemDemo />
                              </ErrorBoundary>
                            } />
                          </Route>
                        </Route>
                        
                        {/* Catch all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                      <SyncStatusBar />
                      <DebugToolbar position="bottom" />
                    </Router>
                    <ToastNotification />
                  </NotificationProvider>
                </OfflineProvider>
              </ConnectionProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeWrapper>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;