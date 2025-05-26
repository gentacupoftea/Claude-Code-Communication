/**
 * ダッシュボードページ
 * 各プラットフォームの統合データを表示
 */
import React, { useEffect, useState } from 'react';
import {
  Grid,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CalendarToday,
  MoreVert,
  TrendingUp,
  ShoppingCart,
  People,
  Inventory,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setDateRange, setLoading } from '../../store/slices/dashboardSlice';
import { MetricCard, DataTable, SearchBar } from '../../molecules';
import { Card, Button } from '../../atoms';
import GlassCard from '../../components/futuristic/GlassCard';
import FuturisticButton from '../../components/futuristic/FuturisticButton';
import { Order } from '../../types';
import { SalesChart } from './components/SalesChart';
import { TopProducts } from './components/TopProducts';
import { RecentOrders } from './components/RecentOrders';
import { PlatformSync } from './components/PlatformSync';
import { DateRangeSelector } from './components/DateRangeSelector';
import { formatCurrency, formatPercent } from '../../utils/format';

interface DashboardProps {}

export const Dashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch<AppDispatch>();
  
  const { metrics, chartData, dateRange, loading } = useSelector(
    (state: RootState) => state.dashboard
  );
  
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  
  // サンプルデータ（実際はAPIから取得）
  const topProducts = [
    { id: '1', name: 'Premium T-Shirt', sales: 245, revenue: 489000 },
    { id: '2', name: 'Organic Coffee Beans', sales: 189, revenue: 378000 },
    { id: '3', name: 'Wireless Headphones', sales: 156, revenue: 468000 },
    { id: '4', name: 'Eco-Friendly Water Bottle', sales: 134, revenue: 201000 },
    { id: '5', name: 'Yoga Mat Premium', sales: 98, revenue: 196000 },
  ];
  
  const recentOrders: Order[] = [
    { 
      id: '1', 
      orderNumber: '#10234', 
      platform: 'shopify',
      customer: {
        name: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        address: {
          line1: '123 Main Street',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      status: 'processing',
      totalAmount: 12900,
      items: [],
      currency: 'JPY',
      updatedAt: new Date(),
    },
    { 
      id: '2', 
      orderNumber: '#10233', 
      platform: 'shopify',
      customer: {
        name: '山田花子',
        email: 'yamada@example.com',
        address: {
          line1: '東京都渋谷区道玄坂1-2-3',
          city: '渋谷区',
          state: '東京都',
          postalCode: '150-0043',
          country: 'JP',
        },
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'delivered',
      totalAmount: 8500,
      items: [],
      currency: 'JPY',
      updatedAt: new Date(),
    },
    { 
      id: '3', 
      orderNumber: '#10232', 
      platform: 'shopify',
      customer: {
        name: 'Michael Chen',
        email: 'mchen@example.com',
        address: {
          line1: '456 Oak Avenue',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'US',
        },
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      status: 'shipped',
      totalAmount: 23500,
      items: [],
      currency: 'JPY',
      updatedAt: new Date(),
    },
  ];

  // ダッシュボードデータの取得
  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    dispatch(setLoading(true));
    try {
      // TODO: APIからデータを取得
      // const data = await dashboardService.getData(dateRange);
      // dispatch(setMetrics(data.metrics));
      // dispatch(setChartData(data.charts));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    dispatch(setDateRange({ start: startDate, end: endDate }));
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    // TODO: エクスポート処理
    console.log(`Export as ${format}`);
    handleMenuClose();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h4" component="h1">
          {t('dashboard.title')}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <DateRangeSelector
            value={dateRange}
            onChange={handleDateRangeChange}
            startIcon={<CalendarToday />}
          />
          
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
          
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => handleExport('csv')}>
              {t('common.export')} (CSV)
            </MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>
              {t('common.export')} (Excel)
            </MenuItem>
            <MenuItem onClick={() => handleExport('pdf')}>
              {t('common.export')} (PDF)
            </MenuItem>
          </Menu>
        </Box>
      </Box>


      {/* メトリクスカード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          ) : (
            <Box
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                borderRadius: 2,
                p: 3,
                color: 'white',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 1, opacity: 0.8 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  総売上
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                ¥{formatCurrency(metrics.totalSales || 2450000)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  前期比 +12.5%
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          ) : (
            <Box
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                borderRadius: 2,
                p: 3,
                color: 'white',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ShoppingCart sx={{ mr: 1, opacity: 0.8 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  注文数
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {metrics.totalOrders || 1250}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  前期比 +8.3%
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          ) : (
            <Box
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                borderRadius: 2,
                p: 3,
                color: 'white',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People sx={{ mr: 1, opacity: 0.8 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  平均注文額
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                ¥{formatCurrency(metrics.averageOrderValue || 19600)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  前期比 -2.1%
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          ) : (
            <Box
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
                borderRadius: 2,
                p: 3,
                color: 'white',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Inventory sx={{ mr: 1, opacity: 0.8 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  コンバージョン
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {formatPercent(metrics.conversionRate || 0.034)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  前期比 +0.5%
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* チャートとテーブル */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 3,
              p: 3,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 8px 12px -2px rgba(0, 0, 0, 0.12), 0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              売上チャート
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            ) : (
              <SalesChart data={chartData?.salesChart || []} />
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12} lg={4}>
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 3,
              p: 3,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 8px 12px -2px rgba(0, 0, 0, 0.12), 0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              人気商品
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            ) : (
              <TopProducts products={topProducts || []} />
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 3,
              p: 3,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 8px 12px -2px rgba(0, 0, 0, 0.12), 0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              最近の注文
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
            ) : (
              <RecentOrders orders={recentOrders || []} />
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;