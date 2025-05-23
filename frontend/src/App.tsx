import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import ThemeWrapper from './components/layout/ThemeWrapper';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import HeroPage from './pages/HeroPage';
import DashboardPageLayout from './pages/DashboardPageLayout';

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
  return (
    <Provider store={store}>
      <ThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider>
            <NotificationProvider>
              <OfflineProvider>
                <AuthProvider>
                  <Router>
                    <Routes>
                      {/* パブリックページ */}
                      <Route path="/" element={<HeroPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      
                      {/* ダッシュボードページ */}
                      <Route path="/dashboard" element={<DashboardPageLayout />} />
                      <Route path="/analytics" element={<DashboardPageLayout />} />
                      <Route path="/chat" element={<DashboardPageLayout />} />
                      <Route path="/orders" element={<DashboardPageLayout />} />
                      <Route path="/customers" element={<DashboardPageLayout />} />
                      <Route path="/products" element={<DashboardPageLayout />} />
                      <Route path="/reports" element={<DashboardPageLayout />} />
                      <Route path="/settings" element={<DashboardPageLayout />} />
                      <Route path="/profile" element={<DashboardPageLayout />} />
                      <Route path="/help" element={<DashboardPageLayout />} />
                      
                      {/* 404ページのリダイレクト */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Router>
                </AuthProvider>
              </OfflineProvider>
            </NotificationProvider>
          </ConnectionProvider>
        </QueryClientProvider>
      </ThemeWrapper>
    </Provider>
  );
};

export default App;