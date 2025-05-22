import React, { useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Skeleton, Alert, Paper, Divider, Chip, useTheme } from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon, 
  ShoppingBag as ShoppingBagIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  ChatBubble as ChatBubbleIcon
} from '@mui/icons-material';
import ChatAssistant from '../chat/ChatAssistant';
import { useTranslation } from 'react-i18next';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { DashboardRequestParams } from '../../api/dashboardService';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  delta?: number;
  loading?: boolean;
}

// KPIカードコンポーネント
const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, delta, loading }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Box
            sx={{
              backgroundColor: theme.palette.primary.main,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              mr: 1,
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle2" color="textSecondary">
            {title}
          </Typography>
        </Box>
        
        {loading ? (
          <Skeleton variant="text" width="80%" height={40} />
        ) : (
          <Typography variant="h4" component="div" fontWeight="bold">
            {value}
          </Typography>
        )}
        
        {delta !== undefined && !loading && (
          <Box display="flex" alignItems="center" mt={1}>
            <Chip
              size="small"
              label={`${delta > 0 ? '+' : ''}${delta}%`}
              color={delta > 0 ? 'success' : delta < 0 ? 'error' : 'default'}
              sx={{ fontSize: '0.75rem', height: 20 }}
            />
            <Typography variant="caption" color="textSecondary" ml={1}>
              前期比
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

interface PlatformDistributionChartProps {
  data: Array<{
    platform: string;
    value: number;
    percentage: number;
  }>;
  loading: boolean;
}

// プラットフォーム分布チャート
const PlatformDistributionChart: React.FC<PlatformDistributionChartProps> = ({ data, loading }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];

  if (loading) {
    return <Skeleton variant="rectangular" width="100%" height={200} />;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {t('dashboard.platformDistribution')}
        </Typography>
        <Box sx={{ height: 240, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString()} 円`, '売上']}
                labelFormatter={(name) => `${name}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

interface TopProductsProps {
  products: Array<{
    id: string;
    name: string;
    sales: number;
    quantity: number;
  }>;
  loading: boolean;
}

// トップ製品コンポーネント
const TopProducts: React.FC<TopProductsProps> = ({ products, loading }) => {
  const { t } = useTranslation();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {t('dashboard.topProducts')}
        </Typography>
        
        {loading ? (
          Array.from(new Array(5)).map((_, index) => (
            <Box key={index} my={2}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          ))
        ) : (
          <Box>
            {products.map((product, index) => (
              <Box key={product.id} my={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                    {index + 1}. {product.name}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {product.sales.toLocaleString()} 円
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  {product.quantity} 個販売
                </Typography>
                {index < products.length - 1 && <Divider sx={{ mt: 1 }} />}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

interface RecentActivityProps {
  activities: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
  loading: boolean;
}

// 最近のアクティビティコンポーネント
const RecentActivity: React.FC<RecentActivityProps> = ({ activities, loading }) => {
  const { t } = useTranslation();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {t('dashboard.recentActivity')}
        </Typography>
        
        {loading ? (
          Array.from(new Array(5)).map((_, index) => (
            <Box key={index} my={2}>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          ))
        ) : (
          <Box>
            {activities.map((activity) => (
              <Box key={activity.id} my={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">
                    {activity.description}
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  {format(new Date(activity.timestamp), 'yyyy/MM/dd HH:mm', { locale: ja })}
                </Typography>
                <Divider sx={{ mt: 1 }} />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * ダッシュボード概要コンポーネント
 */
const DashboardSummary: React.FC = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DashboardRequestParams['dateRange']>({
    startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  
  const { 
    data,
    loading,
    error,
    refresh,
    updateParams
  } = useDashboardSummary({ dateRange });

  // 手動更新
  const handleRefresh = () => {
    refresh();
  };

  // 日付範囲変更
  const handleDateRangeChange = (newDateRange: DashboardRequestParams['dateRange']) => {
    setDateRange(newDateRange);
    updateParams({ dateRange: newDateRange });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          {t('dashboard.summary')}
        </Typography>
        
        <Box>
          {/* ここに日付範囲セレクターを配置できます */}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            size="small"
            sx={{ ml: 1 }}
          >
            {t('common.refresh')}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.message}
        </Alert>
      )}
      
      {/* KPIカード */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title={t('dashboard.totalSales')}
            value={data ? `${data.totalSales.toLocaleString()} 円` : '0 円'}
            icon={<TrendingUpIcon sx={{ color: 'white' }} />}
            delta={data?.periodComparison.sales.change}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title={t('dashboard.totalOrders')}
            value={data ? data.totalOrders.toLocaleString() : '0'}
            icon={<ShoppingBagIcon sx={{ color: 'white' }} />}
            delta={data?.periodComparison.orders.change}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title={t('dashboard.averageOrderValue')}
            value={data ? `${data.averageOrderValue.toLocaleString()} 円` : '0 円'}
            icon={<ShoppingBagIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title={t('dashboard.newCustomers')}
            value={data ? data.newCustomers.toLocaleString() : '0'}
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            delta={data?.periodComparison.customers.change}
            loading={loading}
          />
        </Grid>
      </Grid>
      
      {/* チャートとデータテーブル */}
      <Grid container spacing={3}>
        {/* プラットフォーム分布 */}
        <Grid item xs={12} md={6}>
          <PlatformDistributionChart 
            data={data?.salesByPlatform || []}
            loading={loading}
          />
        </Grid>
        
        {/* トップ製品 */}
        <Grid item xs={12} md={6}>
          <TopProducts 
            products={data?.topProducts || []}
            loading={loading}
          />
        </Grid>
        
        {/* 最近のアクティビティ */}
        <Grid item xs={12} md={6}>
          <RecentActivity 
            activities={data?.recentActivity || []}
            loading={loading}
          />
        </Grid>
        
        {/* チャットアシスタント */}
        <Grid item xs={12} md={6}>
          <ChatAssistant 
            title="MCPアシスタント"
            initialMessage="こんにちは！MCPアシスタントです。ダッシュボードデータや操作方法についてご質問がありましたらお気軽にどうぞ。"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardSummary;