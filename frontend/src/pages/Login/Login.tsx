import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  IconButton,
  InputAdornment,
  Divider,
  Alert,
  Link,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Login as LoginIcon,
  Google,
  GitHub,
  AutoAwesome,
  Rocket,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // デモ用のログイン処理
    setTimeout(() => {
      if (email === 'demo@conea.ai' && password === 'demo123') {
        navigate('/dashboard');
      } else {
        setError('メールアドレスまたはパスワードが正しくありません');
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login with ${provider}`);
    // ソーシャルログイン処理
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #0a0a0a 0%, #000000 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景アニメーション */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at center, rgba(0, 255, 136, 0.05) 0%, transparent 50%)',
          animation: 'pulse 4s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' },
            '50%': { transform: 'translate(-50%, -50%) scale(1.1)' },
          },
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              background: 'rgba(20, 20, 20, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 3,
            }}
          >
            <Stack spacing={3}>
              {/* ロゴ */}
              <Box sx={{ textAlign: 'center' }}>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  <Rocket sx={{ fontSize: 48, color: '#00ff88', mb: 2 }} />
                </motion.div>
                <Typography
                  variant="h4"
                  gutterBottom
                  sx={{
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Conea AI
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  次世代のビジネスインテリジェンスへようこそ
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ backgroundColor: 'rgba(255, 51, 102, 0.1)' }}>
                  {error}
                </Alert>
              )}

              {/* ログインフォーム */}
              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth
                    label="メールアドレス"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#00ff88' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': {
                          borderColor: '#00ff88',
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="パスワード"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#ff0088' }} />
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': {
                          borderColor: '#ff0088',
                        },
                      },
                    }}
                  />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          sx={{
                            color: '#00ff88',
                            '&.Mui-checked': {
                              color: '#00ff88',
                            },
                          }}
                        />
                      }
                      label="ログイン状態を保持"
                    />
                    <Link
                      href="#"
                      sx={{
                        color: '#00aaff',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      パスワードを忘れた場合
                    </Link>
                  </Stack>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      fullWidth
                      size="large"
                      type="submit"
                      variant="contained"
                      disabled={isLoading}
                      startIcon={<LoginIcon />}
                      sx={{
                        py: 1.5,
                        background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                        fontWeight: 600,
                        '&:hover': {
                          background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
                        },
                      }}
                    >
                      {isLoading ? 'ログイン中...' : 'ログイン'}
                    </Button>
                  </motion.div>
                </Stack>
              </form>

              <Stack spacing={2}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    または
                  </Typography>
                </Divider>

                {/* ソーシャルログイン */}
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Google />}
                    onClick={() => handleSocialLogin('google')}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      '&:hover': {
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                      },
                    }}
                  >
                    Google
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<GitHub />}
                    onClick={() => handleSocialLogin('github')}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      '&:hover': {
                        borderColor: '#ff0088',
                        backgroundColor: 'rgba(255, 0, 136, 0.1)',
                      },
                    }}
                  >
                    GitHub
                  </Button>
                </Stack>
              </Stack>

              {/* アカウント作成リンク */}
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  アカウントをお持ちでない方は{' '}
                  <Link
                    href="#"
                    sx={{
                      color: '#00ff88',
                      textDecoration: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    新規登録
                  </Link>
                </Typography>
              </Box>

              {/* デモ情報 */}
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesome sx={{ color: '#00ff88', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: '#00ff88' }}>
                    デモアカウント
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mt: 1 }}>
                  メール: demo@conea.ai<br />
                  パスワード: demo123
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
};