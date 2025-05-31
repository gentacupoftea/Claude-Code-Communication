import React, { useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  TextField,
  Card,
  CardContent,
  IconButton,
  Chip,
  Paper,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HubIcon from '@mui/icons-material/Hub';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PricingCard from '../../components/common/PricingCard/PricingCard';
import AOS from 'aos';
import 'aos/dist/aos.css';

const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf9 100%)',
  paddingTop: theme.spacing(15),
  paddingBottom: theme.spacing(15),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"%3E%3Cpath d="M 100 0 L 0 0 0 100" fill="none" stroke="%23e5e7eb" stroke-width="0.5"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23grid)"/%3E%3C/svg%3E")',
    opacity: 0.3,
  },
}));

const FeatureIcon = styled(Box)(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: 16,
  backgroundColor: 'rgba(52, 211, 153, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
}));

const StatsBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  background: 'white',
  borderRadius: 16,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
}));

const LandingPage: React.FC = () => {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
      easing: 'ease-out',
    });
  }, []);

  const pricingPlans = [
    {
      name: 'スターター',
      price: '¥9,800',
      features: [
        '1店舗まで',
        '基本分析機能',
        '売上レポート',
        'メールサポート',
        'データエクスポート',
      ],
      buttonText: '無料で始める',
    },
    {
      name: 'プロフェッショナル',
      price: '¥29,800',
      features: [
        '5店舗まで',
        'AI分析全機能',
        '在庫最適化',
        'チャットサポート',
        'API連携',
        'カスタムダッシュボード',
      ],
      isRecommended: true,
      buttonText: '無料で始める',
    },
    {
      name: 'エンタープライズ',
      price: 'お問い合わせ',
      features: [
        '無制限の店舗数',
        '専任サポート',
        'カスタマイズ対応',
        'SLA保証',
        'オンプレミス対応',
        '優先サポート',
      ],
      buttonText: 'お問い合わせ',
    },
  ];

  return (
    <Box sx={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ヒーローセクション */}
      <HeroSection>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 'bold',
                  color: '#1e293b',
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  mb: 3,
                  lineHeight: 1.2,
                }}
                data-aos="fade-right"
              >
                AIが導く、次世代の
                <br />
                EC運営プラットフォーム
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ mb: 4, lineHeight: 1.8 }}
                data-aos="fade-right"
                data-aos-delay="100"
              >
                売上分析から在庫管理まで、すべてを一元化。
                <br />
                複数のECプラットフォームを統合管理できる、
                <br />
                ビジネスの成長を加速させるツール。
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }} data-aos="fade-up" data-aos-delay="200">
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    backgroundColor: '#34d399',
                    color: 'white',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px 0 rgba(52, 211, 153, 0.4)',
                    '&:hover': {
                      backgroundColor: '#22c55e',
                    },
                  }}
                >
                  無料で始める
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<PlayCircleOutlineIcon />}
                  sx={{
                    borderColor: '#34d399',
                    color: '#34d399',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#22c55e',
                      backgroundColor: 'rgba(52, 211, 153, 0.04)',
                    },
                  }}
                >
                  デモを見る
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  backgroundColor: '#f8fafc',
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                }}
                data-aos="fade-left"
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <IconButton
                    sx={{
                      backgroundColor: '#34d399',
                      color: 'white',
                      width: 80,
                      height: 80,
                      '&:hover': {
                        backgroundColor: '#22c55e',
                      },
                    }}
                  >
                    <PlayCircleOutlineIcon sx={{ fontSize: 48 }} />
                  </IconButton>
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: '#475569',
                  }}
                >
                  3分でわかるConea
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </HeroSection>

      {/* 特徴セクション */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography
          variant="h3"
          component="h2"
          align="center"
          sx={{
            fontWeight: 'bold',
            color: '#1e293b',
            mb: 2,
          }}
          data-aos="fade-up"
        >
          Coneaの特徴
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 8 }}
          data-aos="fade-up"
          data-aos-delay="100"
        >
          最先端のAI技術で、EC運営を革新します
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4} data-aos="fade-up" data-aos-delay="200">
            <Card
              sx={{
                height: '100%',
                p: 4,
                textAlign: 'center',
                border: '1px solid #e5e7eb',
                boxShadow: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <FeatureIcon>
                <TrendingUpIcon sx={{ fontSize: 36, color: '#34d399' }} />
              </FeatureIcon>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#1e293b' }}>
                AI駆動の分析
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                複数のAIを組み合わせた高精度な売上予測と在庫最適化で、ビジネスの成長を加速
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={4} data-aos="fade-up" data-aos-delay="300">
            <Card
              sx={{
                height: '100%',
                p: 4,
                textAlign: 'center',
                border: '1px solid #e5e7eb',
                boxShadow: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <FeatureIcon>
                <HubIcon sx={{ fontSize: 36, color: '#34d399' }} />
              </FeatureIcon>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#1e293b' }}>
                マルチプラットフォーム対応
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                Shopify、Amazon、楽天、NextEngineを一元管理。すべての販売チャネルを統合
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={4} data-aos="fade-up" data-aos-delay="400">
            <Card
              sx={{
                height: '100%',
                p: 4,
                textAlign: 'center',
                border: '1px solid #e5e7eb',
                boxShadow: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <FeatureIcon>
                <DashboardIcon sx={{ fontSize: 36, color: '#34d399' }} />
              </FeatureIcon>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#1e293b' }}>
                ノーコードダッシュボード
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                ドラッグ&ドロップで自由にカスタマイズ可能。プログラミング知識不要
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* 数値セクション */}
      <Box sx={{ backgroundColor: '#f8fafc', py: 10 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            align="center"
            sx={{
              fontWeight: 'bold',
              color: '#1e293b',
              mb: 2,
            }}
            data-aos="fade-up"
          >
            選ばれる理由
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            align="center"
            sx={{ mb: 8 }}
            data-aos="fade-up"
            data-aos-delay="100"
          >
            数字が証明する、Coneaの実績
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} sm={6} md={3} data-aos="zoom-in" data-aos-delay="200">
              <StatsBox>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 'bold',
                    color: '#34d399',
                    mb: 1,
                  }}
                >
                  10,000+
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  導入企業数
                </Typography>
              </StatsBox>
            </Grid>

            <Grid item xs={12} sm={6} md={3} data-aos="zoom-in" data-aos-delay="300">
              <StatsBox>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 'bold',
                    color: '#34d399',
                    mb: 1,
                  }}
                >
                  18.3%
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  平均売上向上率
                </Typography>
              </StatsBox>
            </Grid>

            <Grid item xs={12} sm={6} md={3} data-aos="zoom-in" data-aos-delay="400">
              <StatsBox>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 'bold',
                    color: '#34d399',
                    mb: 1,
                  }}
                >
                  28.5%
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  在庫効率改善
                </Typography>
              </StatsBox>
            </Grid>

            <Grid item xs={12} sm={6} md={3} data-aos="zoom-in" data-aos-delay="500">
              <StatsBox>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 'bold',
                    color: '#34d399',
                    mb: 1,
                  }}
                >
                  98%
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  サポート満足度
                </Typography>
              </StatsBox>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* 料金プランセクション */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography
          variant="h3"
          component="h2"
          align="center"
          sx={{
            fontWeight: 'bold',
            color: '#1e293b',
            mb: 2,
          }}
          data-aos="fade-up"
        >
          料金プラン
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 8 }}
          data-aos="fade-up"
          data-aos-delay="100"
        >
          ビジネスの規模に合わせて、最適なプランをお選びください
        </Typography>

        <Grid container spacing={4} alignItems="stretch">
          {pricingPlans.map((plan, index) => (
            <Grid
              item
              xs={12}
              md={4}
              key={index}
              data-aos="fade-up"
              data-aos-delay={200 + index * 100}
            >
              <PricingCard plan={plan} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTAセクション */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #34d399 0%, #22c55e 100%)',
          py: 10,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                fontWeight: 'bold',
                color: 'white',
                mb: 3,
              }}
              data-aos="fade-up"
            >
              今すぐ無料トライアルを始める
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                mb: 5,
              }}
              data-aos="fade-up"
              data-aos-delay="100"
            >
              クレジットカード不要。いつでもキャンセル可能。
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: 500,
                mx: 'auto',
              }}
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <TextField
                fullWidth
                placeholder="メールアドレス"
                variant="outlined"
                sx={{
                  backgroundColor: 'white',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'transparent',
                    },
                    '&:hover fieldset': {
                      borderColor: 'transparent',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#34d399',
                    },
                  },
                }}
              />
              <Button
                variant="contained"
                size="large"
                sx={{
                  backgroundColor: '#1e293b',
                  color: 'white',
                  px: 4,
                  py: 1.75,
                  whiteSpace: 'nowrap',
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  '&:hover': {
                    backgroundColor: '#0f172a',
                  },
                }}
              >
                無料で始める
              </Button>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 3,
                mt: 4,
              }}
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="body2">SSL暗号化</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                <VerifiedUserIcon sx={{ mr: 1 }} />
                <Typography variant="body2">プライバシー保護</Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* フッター */}
      <Box sx={{ backgroundColor: '#1e293b', color: 'white', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Conea
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                AIが導く、次世代のEC運営プラットフォーム
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                会社情報
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                会社概要
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                採用情報
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                ニュース
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                サポート
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                ヘルプセンター
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                お問い合わせ
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                API ドキュメント
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                法的情報
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                利用規約
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                プライバシーポリシー
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                特定商取引法に基づく表記
              </Typography>
            </Grid>
          </Grid>
          <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', mt: 4, pt: 4 }}>
            <Typography
              variant="body2"
              align="center"
              sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              © 2024 Conea. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;