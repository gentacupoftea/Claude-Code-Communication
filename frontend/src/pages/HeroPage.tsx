import React from 'react';
import { Box, Typography, Button, Container, Grid, Card, Chip } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ConeaLogo } from '../components/branding/ConeaLogo';

// 独立したテーマ設定
const heroTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F97316',
    },
    secondary: {
      main: '#3B82F6',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

const HeroPage: React.FC = () => {
  return (
    <ThemeProvider theme={heroTheme}>
      <CssBaseline />
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'auto',
        background: 'linear-gradient(145deg, #0A0A0A 0%, #1A1A2E 30%, #16213E  60%, #0F3460 100%)',
        zIndex: 9999
      }}>
        {/* Background subtle patterns */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(249, 115, 22, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)
          `,
          opacity: 0.6
        }} />

        {/* Hero Content */}
        <Container maxWidth="lg" sx={{ 
          position: 'relative', 
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          py: 8
        }}>
          {/* Logo Section */}
          <Box sx={{ 
            mb: 8,
            animation: 'fadeInUp 0.8s ease-out',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0px)' }
            }
          }}>
            <Box sx={{ mb: 4 }}>
              <ConeaLogo 
                variant="horizontal" 
                size="xl" 
                forceWhiteText 
              />
            </Box>
          </Box>

          {/* Main Heading */}
          <Typography 
            variant="h1" 
            component="h1" 
            sx={{ 
              fontWeight: 600, 
              mb: 6,
              fontSize: { xs: '3.5rem', md: '5rem', lg: '6rem' },
              lineHeight: { xs: 1.1, md: 1.05 },
              background: 'linear-gradient(135deg, #FFFFFF 0%, #E5E7EB 50%, #9CA3AF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              animation: 'fadeInUp 0.8s ease-out 0.2s both',
              '@keyframes fadeInUp': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0px)' }
              }
            }}
          >
            次世代EC統合
            <br />
            プラットフォーム
          </Typography>

          {/* Subtitle */}
          <Typography 
            variant="h5" 
            sx={{ 
              mb: 10, 
              color: 'rgba(255, 255, 255, 0.75)',
              maxWidth: '700px',
              mx: 'auto',
              lineHeight: 1.5,
              fontWeight: 400,
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              animation: 'fadeInUp 0.8s ease-out 0.4s both',
              '@keyframes fadeInUp': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0px)' }
              }
            }}
          >
            AIを活用した高度な分析機能で、あなたのECビジネスを次のレベルへ。
            複数のプラットフォームを一元管理し、売上を最大化します。
          </Typography>

          {/* CTA Buttons */}
          <Box sx={{ 
            display: 'flex', 
            gap: 4, 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            mb: 12,
            animation: 'fadeInUp 0.8s ease-out 0.6s both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0px)' }
            }
          }}>
            <Button 
              variant="contained" 
              size="large"
              onClick={() => window.location.href = '/signup'}
              sx={{ 
                py: 2.5,
                px: 8,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.3)',
                textTransform: 'none',
                border: 'none',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 25px rgba(249, 115, 22, 0.4)',
                  background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
                },
                transition: 'all 0.2s ease-out'
              }}
            >
              無料で始める
            </Button>
            <Button 
              variant="outlined" 
              size="large"
              onClick={() => window.location.href = '/login'}
              sx={{ 
                py: 2.5,
                px: 8,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)',
                borderWidth: 1,
                textTransform: 'none',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  transform: 'translateY(-1px)',
                  color: '#FFFFFF'
                },
                transition: 'all 0.2s ease-out'
              }}
            >
              ログイン
            </Button>
          </Box>

          {/* Key Features Grid */}
          <Grid container spacing={6} sx={{ 
            animation: 'fadeInUp 0.8s ease-out 0.8s both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0px)' }
            }
          }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                p: 6, 
                height: '100%',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 3,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                transition: 'all 0.3s ease-out'
              }}>
                <Box sx={{ fontSize: '3rem', mb: 3 }}>📊</Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  リアルタイム分析
                </Typography>
                <Typography sx={{ opacity: 0.8, lineHeight: 1.6, fontSize: '0.95rem' }}>
                  AIを活用した高度な分析機能で、売上データをリアルタイムで可視化
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                p: 6, 
                height: '100%',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 3,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                transition: 'all 0.3s ease-out'
              }}>
                <Box sx={{ fontSize: '3rem', mb: 3 }}>🔗</Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  統合管理
                </Typography>
                <Typography sx={{ opacity: 0.8, lineHeight: 1.6, fontSize: '0.95rem' }}>
                  複数のECプラットフォームを一元管理し、オペレーションを効率化
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                p: 6, 
                height: '100%',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 3,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                transition: 'all 0.3s ease-out'
              }}>
                <Box sx={{ fontSize: '3rem', mb: 3 }}>🤖</Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  AI自動化
                </Typography>
                <Typography sx={{ opacity: 0.8, lineHeight: 1.6, fontSize: '0.95rem' }}>
                  機械学習による需要予測、在庫最適化、価格調整を自動化
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Trust Indicators */}
          <Box sx={{ 
            mt: 12,
            animation: 'fadeInUp 0.8s ease-out 1s both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0px)' }
            }
          }}>
            <Typography variant="body1" sx={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              mb: 4,
              fontSize: '1rem',
              fontWeight: 400
            }}>
              世界中の企業が信頼するプラットフォーム
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap'
            }}>
              <Chip 
                label="99.9% 稼働率" 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.12)',
                  }
                }} 
              />
              <Chip 
                label="24/7 サポート" 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.12)',
                  }
                }} 
              />
              <Chip 
                label="ISO 27001 認証" 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.12)',
                  }
                }} 
              />
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default HeroPage;