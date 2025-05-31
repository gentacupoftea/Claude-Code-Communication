import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Stack,
  ThemeProvider,
  CssBaseline,
  IconButton,
  Fab,
  useScrollTrigger,
  Zoom,
} from '@mui/material';
import { 
  AutoAwesome,
  Rocket,
  DarkMode,
  LightMode,
  KeyboardArrowUp,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { DateRangeSelector } from '../DateRangeSelector';
import { CanvasEditor } from '../CanvasEditor';
import { ProductMetricsCard } from '../ProductMetricsCard';
import { coneaTheme } from '../theme/coneaTheme';

// ライトテーマ
const lightTheme = {
  ...coneaTheme,
  palette: {
    ...coneaTheme.palette,
    mode: 'light' as const,
    background: {
      default: '#f8f9fa',
      paper: 'rgba(255, 255, 255, 0.9)',
    },
    text: {
      primary: '#1a1a1a',
      secondary: 'rgba(0, 0, 0, 0.7)',
    },
  },
};

// ダミーの商品データ
const sampleProducts = [
  {
    id: 1,
    name: 'AI-Powered Analytics Dashboard',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
    sales: 3250000,
    views: 12420,
    orders: 325,
  },
  {
    id: 2,
    name: 'Cloud Native Application Suite',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
    sales: 2890000,
    views: 8100,
    orders: 289,
  },
  {
    id: 3,
    name: 'Quantum Computing Simulator',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
    sales: 5340000,
    views: 15600,
    orders: 534,
  },
  {
    id: 4,
    name: 'Neural Network Framework',
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=300&fit=crop',
    sales: 1560000,
    views: 6200,
    orders: 156,
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

export const DemoPage: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [products, setProducts] = useState(sampleProducts);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [particlesVisible, setParticlesVisible] = useState(true);

  const theme = isDarkMode ? coneaTheme : lightTheme;

  const handleMetricUpdate = (productId: number, key: 'sales' | 'views' | 'orders', value: number) => {
    setProducts(products.map(product => 
      product.id === productId 
        ? { ...product, [key]: value }
        : product
    ));
  };

  useEffect(() => {
    const handleScroll = () => {
      setParticlesVisible(window.scrollY < 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: isDarkMode
            ? 'radial-gradient(ellipse at top, #0a0a0a 0%, #000000 100%)'
            : 'radial-gradient(ellipse at top, #ffffff 0%, #f8f9fa 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景パーティクル効果 */}
        <AnimatePresence>
          {particlesVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: Math.random() * 4 + 2,
                    height: Math.random() * 4 + 2,
                    background: i % 3 === 0 ? '#00ff88' : i % 3 === 1 ? '#ff0088' : '#00aaff',
                    borderRadius: '50%',
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    filter: 'blur(1px)',
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{
                    duration: Math.random() * 10 + 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: Math.random() * 5,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* テーマ切り替えボタン */}
        <IconButton
          onClick={() => setIsDarkMode(!isDarkMode)}
          sx={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          {isDarkMode ? <LightMode sx={{ color: '#ffaa00' }} /> : <DarkMode sx={{ color: '#aa00ff' }} />}
        </IconButton>

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: 4 }}>
          <Stack spacing={8}>
            {/* ヒーローセクション */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  <Rocket sx={{ fontSize: 64, color: '#00ff88', mb: 2 }} />
                </motion.div>
                
                <Typography
                  variant="h1"
                  component="h1"
                  gutterBottom
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '3rem', md: '5rem' },
                    background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 50%, #00aaff 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 80px rgba(0, 255, 136, 0.5)',
                    mb: 2,
                  }}
                >
                  Conea Dashboard
                </Typography>
                
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 300,
                    color: theme.palette.text.secondary,
                    mb: 4,
                  }}
                >
                  次世代のビジネスインテリジェンス
                </Typography>
                
                <Stack direction="row" spacing={2} justifyContent="center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 3,
                        py: 1.5,
                        borderRadius: 20,
                        background: 'rgba(0, 255, 136, 0.1)',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                      }}
                    >
                      <AutoAwesome sx={{ fontSize: 20, color: '#00ff88' }} />
                      <Typography variant="body2" sx={{ color: '#00ff88' }}>
                        AI-Powered Analytics
                      </Typography>
                    </Box>
                  </motion.div>
                </Stack>
              </Box>
            </motion.div>

            {/* DateRangeSelector セクション */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Box>
                <Typography
                  variant="h3"
                  component="h2"
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    mb: 4,
                    background: 'linear-gradient(135deg, #00ff88 0%, #00aaff 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <AutoAwesome sx={{ mr: 2, verticalAlign: 'middle' }} />
                  Date Range Selector
                </Typography>
                <DateRangeSelector
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />
              </Box>
            </motion.div>

            {/* CanvasEditor セクション */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Box>
                <Typography
                  variant="h3"
                  component="h2"
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    mb: 4,
                    background: 'linear-gradient(135deg, #ff0088 0%, #aa00ff 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <AutoAwesome sx={{ mr: 2, verticalAlign: 'middle' }} />
                  Canvas Editor
                </Typography>
                <CanvasEditor width={1200} height={500} />
              </Box>
            </motion.div>

            {/* ProductMetricsCard セクション */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Box>
                <Typography
                  variant="h3"
                  component="h2"
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    mb: 4,
                    background: 'linear-gradient(135deg, #00aaff 0%, #ffaa00 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <AutoAwesome sx={{ mr: 2, verticalAlign: 'middle' }} />
                  Product Metrics
                </Typography>
                <Grid container spacing={4}>
                  {products.map((product, index) => (
                    <Grid item xs={12} sm={6} md={3} key={product.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                      >
                        <ProductMetricsCard
                          productName={product.name}
                          productImage={product.image}
                          sales={product.sales}
                          views={product.views}
                          orders={product.orders}
                          onMetricUpdate={(key, value) => handleMetricUpdate(product.id, key, value)}
                        />
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </motion.div>

            {/* フッター */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
            >
              <Box sx={{ mt: 12, pb: 8, textAlign: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    mb: 2,
                  }}
                >
                  © 2024 Conea Integration
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 600,
                  }}
                >
                  Built with React, TypeScript & Material-UI
                </Typography>
              </Box>
            </motion.div>
          </Stack>
        </Container>

        <ScrollTop />
      </Box>
    </ThemeProvider>
  );
};