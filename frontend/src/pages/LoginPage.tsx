import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  LightMode,
  DarkMode,
} from '@mui/icons-material';
// import { useAuth } from '../contexts/AuthContext';
import { ConeaLogo } from '../components/branding/ConeaLogo';
import { useTheme as useAppTheme } from '../hooks/useTheme';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { toggleTheme, themeMode } = useAppTheme();
  // const { login, error, isLoading, clearError } = useAuth();
  const error = null;
  const isLoading = false;
  const clearError = () => {};
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Simulated login for demo
      console.log('Login attempt:', { email, password });
      // await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      // Error is handled in AuthContext
      console.error('Login error:', err);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'
          : 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* テーマ切り替えボタン */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        }}
      >
        {themeMode === 'dark' ? <LightMode /> : <DarkMode />}
      </IconButton>

      <Container maxWidth="sm">
        <Card
          sx={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <CardContent sx={{ p: 6 }}>
            {/* ロゴ */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
                  boxShadow: '0 10px 25px -5px rgba(52, 211, 153, 0.4)',
                }}
              >
                <ConeaLogo variant="icon-only" size="md" />
              </Box>
            </Box>

            {/* ヘッダー */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Coneaにログイン
              </Typography>
              <Typography variant="body1" color="text.secondary">
                アカウント情報を入力してログインしてください
              </Typography>
            </Box>

            {/* エラーメッセージ */}
            {error && (
              <Alert 
                severity="error" 
                sx={{ mb: 3, borderRadius: 2 }}
                onClose={clearError}
              >
                {error}
              </Alert>
            )}

            {/* ログインフォーム */}
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="パスワード"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="ログイン状態を保持"
                />
                <Link 
                  to="/forgot-password" 
                  style={{ 
                    textDecoration: 'none',
                    color: theme.palette.primary.main,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  パスワードをお忘れですか？
                </Link>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  mb: 3,
                  background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
                  boxShadow: '0 4px 14px 0 rgba(52, 211, 153, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
                    boxShadow: '0 6px 20px 0 rgba(52, 211, 153, 0.6)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.5) 0%, rgba(96, 165, 250, 0.5) 100%)',
                  },
                }}
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </Button>

              <Divider sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  または
                </Typography>
              </Divider>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  アカウントをお持ちでないですか？{' '}
                  <Link 
                    to="/signup" 
                    style={{ 
                      textDecoration: 'none',
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                    }}
                  >
                    新規登録
                  </Link>
                </Typography>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;