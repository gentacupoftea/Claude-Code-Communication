import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  IconButton,
  useScrollTrigger,
  AppBar,
  Toolbar,
  Fade,
  Zoom,
  Fab,
} from '@mui/material';
import {
  AutoAwesome,
  Rocket,
  Speed,
  Analytics,
  Security,
  Cloud,
  ArrowForward,
  KeyboardArrowUp,
  PlayArrow,
  CheckCircle,
  TrendingUp,
  Psychology,
  Insights,
  Dashboard,
} from '@mui/icons-material';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: <Psychology />,
    title: 'AI駆動の分析',
    description: '最先端のAIが、ビジネスの成長機会を自動的に発見します',
    color: '#00ff88',
  },
  {
    icon: <Speed />,
    title: 'リアルタイム処理',
    description: 'ミリ秒単位でデータを処理し、即座にインサイトを提供',
    color: '#ff0088',
  },
  {
    icon: <Analytics />,
    title: '高度な可視化',
    description: '複雑なデータを直感的で美しいビジュアルに変換',
    color: '#00aaff',
  },
  {
    icon: <Security />,
    title: 'エンタープライズセキュリティ',
    description: '業界最高水準のセキュリティでビジネスデータを保護',
    color: '#ffaa00',
  },
  {
    icon: <Cloud />,
    title: 'クラウドネイティブ',
    description: 'どこからでもアクセス可能な、スケーラブルな基盤',
    color: '#aa00ff',
  },
  {
    icon: <Insights />,
    title: '予測分析',
    description: '過去のデータから未来のトレンドを高精度で予測',
    color: '#ff3366',
  },
];

function ScrollTop() {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
      >
        <Fab
          size="small"
          sx={{
            background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
            },
          }}
        >
          <KeyboardArrowUp />
        </Fab>
      </Box>
    </Zoom>
  );
}

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleDemo = () => {
    navigate('/demo');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #0a0a0a 0%, #000000 100%)',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* ヘッダー */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
            <Rocket sx={{ color: '#00ff88' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Conea AI
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={2}>
            <Button
              color="inherit"
              onClick={() => navigate('/demo')}
              sx={{ '&:hover': { color: '#00ff88' } }}
            >
              デモ
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/login')}
              sx={{ '&:hover': { color: '#ff0088' } }}
            >
              ログイン
            </Button>
            <Button
              variant="contained"
              onClick={handleGetStarted}
              sx={{
                background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
                },
              }}
            >
              無料で始める
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ヒーローセクション */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          pt: 8,
        }}
      >
        {/* 背景エフェクト */}
        <motion.div
          style={{ y, opacity }}
          className="hero-background"
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '150%',
              height: '150%',
              background: 'radial-gradient(circle at center, rgba(0, 255, 136, 0.1) 0%, transparent 50%)',
              filter: 'blur(100px)',
            }}
          />
        </motion.div>

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={4} alignItems="center" textAlign="center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 50 }}
              transition={{ duration: 0.8 }}
            >
              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" mb={2}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <AutoAwesome sx={{ fontSize: 32, color: '#00ff88' }} />
                </motion.div>
                <Typography
                  variant="body1"
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: 20,
                    background: 'rgba(0, 255, 136, 0.1)',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    color: '#00ff88',
                  }}
                >
                  AI-Powered Business Intelligence
                </Typography>
              </Stack>

              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '3rem', md: '5rem', lg: '6rem' },
                  fontWeight: 900,
                  lineHeight: 1.1,
                  background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 50%, #00aaff 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 3,
                }}
              >
                次世代の
                <br />
                ビジネスインサイト
              </Typography>

              <Typography
                variant="h5"
                sx={{
                  maxWidth: 800,
                  mx: 'auto',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 300,
                  lineHeight: 1.6,
                }}
              >
                AIが導く、データドリブンな意思決定。
                <br />
                複雑なデータを、シンプルで美しいインサイトに。
              </Typography>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForward />}
                  onClick={handleGetStarted}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  無料で始める
                </Button>
                
                <Button
                  size="large"
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={handleDemo}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#fff',
                    '&:hover': {
                      borderColor: '#ff0088',
                      backgroundColor: 'rgba(255, 0, 136, 0.1)',
                    },
                  }}
                >
                  デモを見る
                </Button>
              </Stack>
            </motion.div>

            {/* 統計情報 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Stack
                direction="row"
                spacing={4}
                sx={{
                  mt: 6,
                  p: 3,
                  borderRadius: 3,
                  background: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Box textAlign="center">
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#00ff88' }}>
                    98%
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    精度向上
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#ff0088' }}>
                    10x
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    処理速度
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#00aaff' }}>
                    24/7
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    サポート
                  </Typography>
                </Box>
              </Stack>
            </motion.div>
          </Stack>
        </Container>
      </Box>

      {/* 機能セクション */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Typography
            variant="h2"
            textAlign="center"
            sx={{
              mb: 2,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #00ff88 0%, #00aaff 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            パワフルな機能
          </Typography>
          <Typography
            variant="h6"
            textAlign="center"
            sx={{
              mb: 8,
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 300,
            }}
          >
            ビジネスを次のレベルへ導く、革新的な機能群
          </Typography>
        </motion.div>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(20, 20, 20, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      border: `1px solid ${feature.color}`,
                      boxShadow: `0 8px 32px ${feature.color}33`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${feature.color}33 0%, ${feature.color}11 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                      }}
                    >
                      {React.cloneElement(feature.icon as React.ReactElement, {
                        sx: { fontSize: 32, color: feature.color },
                      })}
                    </Box>
                    <Typography
                      variant="h5"
                      gutterBottom
                      sx={{ fontWeight: 700, color: '#fff' }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}
                    >
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA セクション */}
      <Box
        sx={{
          py: 12,
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(255, 0, 136, 0.1) 100%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Stack spacing={4} alignItems="center" textAlign="center">
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                今すぐ始めましょう
              </Typography>
              
              <Typography
                variant="h6"
                sx={{
                  maxWidth: 600,
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 300,
                }}
              >
                14日間の無料トライアル。クレジットカード不要。
                <br />
                いつでもキャンセル可能。
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <CheckCircle sx={{ color: '#00ff88' }} />
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  すべての機能が利用可能
                </Typography>
              </Stack>

              <Button
                size="large"
                variant="contained"
                endIcon={<Rocket />}
                onClick={handleGetStarted}
                sx={{
                  px: 6,
                  py: 2,
                  fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                  boxShadow: '0 8px 32px rgba(0, 255, 136, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(0, 255, 136, 0.5)',
                  },
                }}
              >
                無料トライアルを開始
              </Button>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* フッター */}
      <Box sx={{ py: 6, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Rocket sx={{ color: '#00ff88' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Conea AI
              </Typography>
            </Stack>
            
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              © 2024 Conea AI. All rights reserved.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <ScrollTop />
    </Box>
  );
};