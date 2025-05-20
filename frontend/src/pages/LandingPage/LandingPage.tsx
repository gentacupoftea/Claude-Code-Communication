import React from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
  Stack,
  IconButton,
  alpha,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
// import { motion } from 'framer-motion';
import {
  ShoppingCartIcon,
  ChartBarIcon,
  ClockIcon,
  CloudIcon,
  ChatBubbleBottomCenterTextIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const features = [
  {
    icon: ShoppingCartIcon,
    titleKey: 'landing.features.multiPlatform.title',
    descriptionKey: 'landing.features.multiPlatform.description',
  },
  {
    icon: ChatBubbleBottomCenterTextIcon,
    titleKey: 'landing.features.chatAnalysis.title',
    descriptionKey: 'landing.features.chatAnalysis.description',
  },
  {
    icon: ChartBarIcon,
    titleKey: 'landing.features.dashboard.title',
    descriptionKey: 'landing.features.dashboard.description',
  },
  {
    icon: ClockIcon,
    titleKey: 'landing.features.realTime.title',
    descriptionKey: 'landing.features.realTime.description',
  },
  {
    icon: CloudIcon,
    titleKey: 'landing.features.cloud.title',
    descriptionKey: 'landing.features.cloud.description',
  },
  {
    icon: CogIcon,
    titleKey: 'landing.features.automation.title',
    descriptionKey: 'landing.features.automation.description',
  },
];

const platforms = [
  { name: 'Shopify', logo: '/images/shopify-logo.svg' },
  { name: 'Rakuten', logo: '/images/rakuten-logo.svg' },
  { name: 'Amazon', logo: '/images/amazon-logo.svg' },
  { name: 'Yahoo', logo: '/images/yahoo-logo.svg' },
  { name: 'BASE', logo: '/images/base-logo.svg' },
  { name: 'Mercari', logo: '/images/mercari-logo.svg' },
];

export const LandingPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();

  const heroAnimation = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: 'easeOut',
      },
    },
  };

  const featureAnimation = {
    hidden: { opacity: 0, y: 30 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: index * 0.1,
        ease: 'easeOut',
      },
    }),
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.default} 100%)`,
      }}
    >
      {/* ヘッダー */}
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          bgcolor: alpha(theme.palette.background.default, 0.9),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 2,
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
              }}
            >
              Shopify MCP Server
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                color="primary"
              >
                {t('common.login')}
              </Button>
              <Button
                component={RouterLink}
                to="/signup"
                variant="contained"
                color="primary"
              >
                {t('common.signUp')}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ヒーローセクション */}
      <Container maxWidth="lg" sx={{ pt: 15, pb: 10 }}>
        <div
        >
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                }}
              >
                {t('landing.hero.title')}
              </Typography>
              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ mb: 4, lineHeight: 1.6 }}
              >
                {t('landing.hero.subtitle')}
              </Typography>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <Button
                  component={RouterLink}
                  to="/signup"
                  variant="contained"
                  size="large"
                  color="primary"
                  sx={{ py: 2, px: 4 }}
                >
                  {t('landing.hero.cta.primary')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/demo"
                  variant="outlined"
                  size="large"
                  color="primary"
                  sx={{ py: 2, px: 4 }}
                >
                  {t('landing.hero.cta.secondary')}
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: theme.shadows[10],
                }}
              >
                <img
                  src="/images/dashboard-preview.png"
                  alt="Dashboard Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </div>
      </Container>

      {/* 対応プラットフォーム */}
      <Box sx={{ py: 8, bgcolor: theme.palette.background.paper }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            align="center"
            sx={{ mb: 6, fontWeight: 600 }}
          >
            {t('landing.platforms.title')}
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            {platforms.map((platform) => (
              <Grid item key={platform.name}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.default,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <img
                    src={platform.logo}
                    alt={platform.name}
                    style={{
                      height: 40,
                      width: 'auto',
                    }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* 機能紹介 */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography
          variant="h4"
          align="center"
          sx={{ mb: 8, fontWeight: 600 }}
        >
          {t('landing.features.title')}
        </Typography>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <div>
                <Box
                  sx={{
                    p: 4,
                    height: '100%',
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.paper,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <IconButton
                    sx={{
                      mb: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                      },
                    }}
                  >
                    <feature.icon style={{ width: 24, height: 24 }} />
                  </IconButton>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t(feature.titleKey)}
                  </Typography>
                  <Typography color="text.secondary">
                    {t(feature.descriptionKey)}
                  </Typography>
                </Box>
              </div>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA セクション */}
      <Box
        sx={{
          py: 8,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            align="center"
            sx={{ mb: 3, fontWeight: 700 }}
          >
            {t('landing.cta.title')}
          </Typography>
          <Typography
            variant="h6"
            align="center"
            sx={{ mb: 4, opacity: 0.9 }}
          >
            {t('landing.cta.subtitle')}
          </Typography>
          <Box sx={{ textAlign: 'center' }}>
            <Button
              component={RouterLink}
              to="/signup"
              variant="contained"
              size="large"
              sx={{
                py: 2,
                px: 6,
                bgcolor: 'white',
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: alpha('#FFFFFF', 0.9),
                },
              }}
            >
              {t('landing.cta.button')}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* フッター */}
      <Box
        component="footer"
        sx={{
          py: 4,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
          >
            © 2024 Shopify MCP Server. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};