/**
 * Conea Admin Dashboard - Main Application
 * MultiLLM自律システム管理ダッシュボード
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';

// Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Pages
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import EditableAPIKeyManager from './pages/APIKeys/EditableAPIKeyManager';
import MonitoringPage from './pages/Monitoring/MonitoringPage';
import ProjectBoxes from './pages/Projects/ProjectBoxes';
import BillingPage from './pages/Billing/BillingPage';
import SettingsPage from './pages/Settings/SettingsPage';
import SlackIntegration from './pages/SlackIntegration/SlackIntegration';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#3b82f6',
      dark: '#1d4ed8',
    },
    secondary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <DashboardProvider>
          <Router>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Routes>
                {/* 認証ページ */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* 保護されたルート */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  {/* ダッシュボードルート */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  
                  {/* AI エージェント管理 */}
                  <Route path="agents" element={<DashboardPage />} />
                  
                  {/* API キー管理 */}
                  <Route path="api-keys" element={<EditableAPIKeyManager />} />
                  
                  {/* Slack統合 */}
                  <Route path="slack" element={<SlackIntegration />} />
                  
                  {/* 監視・分析 */}
                  <Route path="monitoring" element={<MonitoringPage />} />
                  
                  {/* プロジェクト管理 */}
                  <Route path="projects" element={<ProjectBoxes />} />
                  
                  {/* 課金・請求 */}
                  <Route path="billing" element={<BillingPage />} />
                  
                  {/* 設定 */}
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                
                {/* 404リダイレクト */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Box>
            
            {/* トースト通知 */}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </Router>
        </DashboardProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;