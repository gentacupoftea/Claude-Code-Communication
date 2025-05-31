import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { DashboardBuilder, store } from './features/dashboard';
import { MultiLLMProvider } from './features/multiLLM';
import { DemoPage } from './features/dashboard/components/DemoPage';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';
import LandingPage from './pages/LandingPage/LandingPage';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ff88',
      light: '#66ffb2',
      dark: '#00cc66',
    },
    secondary: {
      main: '#ff0088',
      light: '#ff66b2',
      dark: '#cc0066',
    },
    background: {
      default: '#0a0a0a',
      paper: 'rgba(20, 20, 20, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(255, 0, 136, 0.1) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(20, 20, 20, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

// デモダッシュボードを作成
const demoDashboard = {
  id: 'demo-1',
  name: 'Conea ビジネスダッシュボード',
  description: 'AI駆動のビジネス分析ダッシュボード',
  widgets: [],
  layout: {
    cols: 12,
    rowHeight: 60,
    margin: [10, 10] as [number, number],
    containerPadding: [10, 10] as [number, number],
    compactType: 'vertical' as const,
  },
  theme: {
    primary: '#3498db',
    secondary: '#2ecc71',
    background: '#f5f6fa',
    surface: '#ffffff',
    text: '#2c3e50',
    mode: 'light' as const,
  },
  filters: [],
  created: new Date(),
  updated: new Date(),
  tags: ['demo', 'sales', 'analytics'],
  isPublic: true,
};

// ストアにデモダッシュボードを設定
store.dispatch({
  type: 'dashboard/setCurrentDashboard',
  payload: demoDashboard,
});

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <MultiLLMProvider>
            <div className="App">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/old-landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <>
                      <AppBar position="static" sx={{ mb: 4 }}>
                        <Toolbar>
                          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            Conea Integration
                          </Typography>
                          <Button color="inherit" component={Link} to="/dashboard">
                            Dashboard
                          </Button>
                          <Button color="inherit" component={Link} to="/demo">
                            Components Demo
                          </Button>
                        </Toolbar>
                      </AppBar>
                      <Container maxWidth={false}>
                        <DashboardBuilder />
                      </Container>
                    </>
                  } 
                />
                <Route path="/demo" element={<DemoPage />} />
              </Routes>
            </div>
          </MultiLLMProvider>
        </Router>
      </ThemeProvider>
    </Provider>
  );
}

export default App;