import React, { useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Skeleton, Alert, Paper, Divider, Chip, useTheme } from '@mui/material';
import { ConeaLogo } from '../branding/ConeaLogo';
import { 
  TrendingUp as TrendingUpIcon, 
  ShoppingBag as ShoppingBagIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  ChatBubble as ChatBubbleIcon
} from '@mui/icons-material';

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
    <Card sx={{ 
      height: '100%',
      background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, rgba(96, 165, 250, 0.05) 100%)',
      border: '1px solid rgba(52, 211, 153, 0.1)',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(52, 211, 153, 0.15)',
        transition: 'all 0.3s ease',
      }
    }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Box
            sx={{
              background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              mr: 1,
              boxShadow: '0 4px 12px rgba(52, 211, 153, 0.3)',
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
          プラットフォーム分布
        </Typography>
        <Box sx={{ height: 240, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            📊 チャートを準備中...
          </Typography>
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
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          トップ製品
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
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          最近のアクティビティ
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
                  {new Date(activity.timestamp).toLocaleString()}
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
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  
  // サンプルデータ
  const data = {
    totalSales: 1234567,
    totalOrders: 2456,
    averageOrderValue: 5500,
    newCustomers: 89,
    periodComparison: {
      sales: { change: 12.5 },
      orders: { change: 8.3 },
      customers: { change: 15.2 }
    },
    salesByPlatform: [
      { platform: 'Shopify', value: 800000, percentage: 65 },
      { platform: 'Rakuten', value: 300000, percentage: 24 },
      { platform: 'Amazon', value: 134567, percentage: 11 }
    ],
    topProducts: [
      { id: '1', name: 'プロダクトA', sales: 450000, quantity: 120 },
      { id: '2', name: 'プロダクトB', sales: 320000, quantity: 80 },
      { id: '3', name: 'プロダクトC', sales: 280000, quantity: 95 }
    ],
    recentActivity: [
      { id: '1', type: 'order', description: '新規注文が追加されました', timestamp: new Date().toISOString() },
      { id: '2', type: 'sync', description: 'Shopifyデータを同期しました', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: '3', type: 'customer', description: '新規顧客が登録されました', timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
    ]
  };

  // 手動更新
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            📊 Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ビジネス概要とKPIの一覧表示
          </Typography>
        </Box>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            size="small"
            sx={{ ml: 1 }}
          >
            更新
          </Button>
        </Box>
      </Box>
      
      {/* KPIカード */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="総売上"
            value={`${data.totalSales.toLocaleString()} 円`}
            icon={<TrendingUpIcon sx={{ color: 'white' }} />}
            delta={data.periodComparison.sales.change}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="総注文数"
            value={data.totalOrders.toLocaleString()}
            icon={<ShoppingBagIcon sx={{ color: 'white' }} />}
            delta={data.periodComparison.orders.change}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="平均注文金額"
            value={`${data.averageOrderValue.toLocaleString()} 円`}
            icon={<ShoppingBagIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="新規顧客"
            value={data.newCustomers.toLocaleString()}
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            delta={data.periodComparison.customers.change}
            loading={loading}
          />
        </Grid>
      </Grid>
      
      {/* チャートとデータテーブル */}
      <Grid container spacing={3}>
        {/* プラットフォーム分布 */}
        <Grid item xs={12} md={6}>
          <PlatformDistributionChart 
            data={data.salesByPlatform}
            loading={loading}
          />
        </Grid>
        
        {/* トップ製品 */}
        <Grid item xs={12} md={6}>
          <TopProducts 
            products={data.topProducts}
            loading={loading}
          />
        </Grid>
        
        {/* 最近のアクティビティ */}
        <Grid item xs={12} md={6}>
          <RecentActivity 
            activities={data.recentActivity}
            loading={loading}
          />
        </Grid>
        
        {/* システム状態 */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                🤖 システム状態
              </Typography>
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="success.main" gutterBottom>
                  ✅ Shopify連携: 正常
                </Typography>
                <Typography variant="body2" color="warning.main" gutterBottom>
                  ⚠️ Rakuten連携: 確認中
                </Typography>
                <Typography variant="body2" color="info.main">
                  ℹ️ Amazon連携: 準備中
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardSummary;