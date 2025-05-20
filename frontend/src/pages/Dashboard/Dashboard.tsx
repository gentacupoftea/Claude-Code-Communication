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
    { id: '1', name: '商品A', sales: 100, revenue: 10000 },
    { id: '2', name: '商品B', sales: 80, revenue: 8000 },
    { id: '3', name: '商品C', sales: 60, revenue: 6000 },
  ];
  
  const recentOrders: Order[] = [
    { 
      id: '1', 
      orderNumber: '1001', 
      platform: 'shopify',
      customer: {
        name: '田中太郎',
        email: 'tanaka@example.com',
        address: {
          line1: '東京都渋谷区',
          city: '渋谷',
          state: '東京都',
          postalCode: '150-0001',
          country: 'JP',
        },
      },
      createdAt: new Date(),
      status: 'delivered',
      totalAmount: 5000,
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

      {/* プラットフォーム同期状態 */}
      <Box sx={{ mb: 3 }}>
        <PlatformSync 
          platforms={[
            { platform: 'shopify', lastSync: new Date(), status: 'synced' },
            { platform: 'rakuten', lastSync: new Date(), status: 'pending' },
            { platform: 'amazon', lastSync: new Date(), status: 'error' },
          ]}
          onSync={(platform) => console.log('Sync', platform)}
        />
      </Box>

      {/* メトリクスカード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : (
            <MetricCard
              title={t('dashboard.totalSales')}
              value={metrics.totalSales}
              format="currency"
              currency="JPY"
              trend={{
                value: 12.5,
                direction: 'up',
              }}
              info={t('dashboard.salesInfo')}
            />
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : (
            <MetricCard
              title={t('dashboard.totalOrders')}
              value={metrics.totalOrders}
              format="number"
              trend={{
                value: 8.3,
                direction: 'up',
              }}
              info={t('dashboard.ordersInfo')}
            />
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : (
            <MetricCard
              title={t('dashboard.averageOrderValue')}
              value={metrics.averageOrderValue}
              format="currency"
              currency="JPY"
              trend={{
                value: -2.1,
                direction: 'down',
              }}
              info={t('dashboard.aovInfo')}
            />
          )}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : (
            <MetricCard
              title={t('dashboard.conversionRate')}
              value={metrics.conversionRate}
              format="percent"
              trend={{
                value: 0.5,
                direction: 'up',
              }}
              info={t('dashboard.conversionInfo')}
            />
          )}
        </Grid>
      </Grid>

      {/* チャートとテーブル */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card title={t('dashboard.salesChart')} sx={{ height: '100%' }}>
            {loading ? (
              <Skeleton variant="rectangular" height={400} />
            ) : (
              <SalesChart data={chartData?.salesChart || []} />
            )}
          </Card>
        </Grid>
        
        <Grid item xs={12} lg={4}>
          <Card title={t('dashboard.topProducts')} sx={{ height: '100%' }}>
            {loading ? (
              <Skeleton variant="rectangular" height={400} />
            ) : (
              <TopProducts products={topProducts || []} />
            )}
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card title={t('dashboard.recentOrders')}>
            {loading ? (
              <Skeleton variant="rectangular" height={300} />
            ) : (
              <RecentOrders orders={recentOrders || []} />
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;