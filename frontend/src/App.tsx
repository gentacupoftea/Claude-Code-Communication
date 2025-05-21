import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
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
          <AuthProvider>
            <ConnectionProvider>
              <Router>
                <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                
                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/server-connection" element={<ServerConnectionPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/analytics" element={<AnalyticsDashboard />} />
                    <Route path="/api-settings" element={<ApiSettings />} />
                    <Route path="/chat" element={<ChatAnalysis />} />
                    <Route path="/dashboard-editor" element={<DashboardEditor />} />
                    <Route path="/dashboard-editor/:id" element={<DashboardEditor />} />
                    <Route path="/saved-dashboards" element={<SavedDashboards />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<UserProfilePage />} />
                    <Route path="/profile/edit" element={<ProfileEdit />} />
                    <Route path="/notifications" element={<Notifications />} />
                  </Route>
                </Route>
                
                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Router>
            </ConnectionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeWrapper>
    </Provider>
  );
};

export default App;