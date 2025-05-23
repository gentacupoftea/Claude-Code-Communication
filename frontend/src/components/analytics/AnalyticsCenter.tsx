import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  ShowChart,
  TableChart,
  DateRange,
  FileDownload,
  Refresh,
  FilterList,
  ZoomIn,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
} from 'recharts';

interface AnalyticsData {
  period: string;
  sales: number;
  orders: number;
  customers: number;
  revenue: number;
  conversion: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, trend, icon }) => {
  const theme = useTheme();
  
  const getTrendColor = () => {
    if (trend === 'up') return theme.palette.success.main;
    if (trend === 'down') return theme.palette.error.main;
    return theme.palette.text.secondary;
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp fontSize="small" />;
    if (trend === 'down') return <TrendingDown fontSize="small" />;
    return null;
  };

  const getGradientColor = () => {
    if (trend === 'up') return `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`;
    if (trend === 'down') return `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`;
    return `linear-gradient(135deg, #34D399, #60A5FA)`;
  };

  return (
    <Box
      sx={{
        background: getGradientColor(),
        borderRadius: 3,
        p: 3,
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease-in-out',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <Box display="flex" alignItems="center" mb={2}>
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            p: 1.5,
            display: 'flex',
            mr: 2,
            color: 'white',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.95 }}>
          {title}
        </Typography>
      </Box>
      
      <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 1, flex: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>
      
      <Box display="flex" alignItems="center">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 1,
            px: 1,
            py: 0.5,
          }}
        >
          {getTrendIcon()}
          <Typography
            variant="body2"
            sx={{ ml: 0.5, fontWeight: 600 }}
          >
            {Math.abs(change).toFixed(1)}%
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ ml: 1, opacity: 0.9 }}>
          前期比
        </Typography>
      </Box>
    </Box>
  );
};

const AnalyticsCenter: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');
  const [chartType, setChartType] = useState('line');

  // サンプルデータ
  const salesData: AnalyticsData[] = [
    { period: '1/1', sales: 45000, orders: 120, customers: 89, revenue: 450000, conversion: 2.4 },
    { period: '1/8', sales: 52000, orders: 135, customers: 98, revenue: 520000, conversion: 2.8 },
    { period: '1/15', sales: 48000, orders: 128, customers: 92, revenue: 480000, conversion: 2.6 },
    { period: '1/22', sales: 58000, orders: 145, customers: 105, revenue: 580000, conversion: 3.1 },
    { period: '1/29', sales: 61000, orders: 152, customers: 110, revenue: 610000, conversion: 3.3 },
  ];

  const categoryData: CategoryData[] = [
    { name: 'Electronics', value: 35, color: theme.palette.primary.main },
    { name: 'Apparel', value: 28, color: theme.palette.secondary.main },
    { name: 'Home & Garden', value: 22, color: theme.palette.success.main },
    { name: 'Sports', value: 15, color: theme.palette.warning.main },
  ];

  const productData = [
    { name: 'Product A', sales: 850000, orders: 230, trend: 'up' as const },
    { name: 'Product B', sales: 720000, orders: 195, trend: 'up' as const },
    { name: 'Product C', sales: 650000, orders: 175, trend: 'down' as const },
    { name: 'Product D', sales: 580000, orders: 156, trend: 'stable' as const },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const handleExport = () => {
    // エクスポート処理
    console.log('Exporting analytics data...');
  };

  const renderChart = () => {
    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="sales"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              name="売上"
            />
            <Line
              type="monotone"
              dataKey="orders"
              stroke={theme.palette.secondary.main}
              strokeWidth={2}
              name="注文数"
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={theme.palette.primary.main}
              fill={theme.palette.primary.light}
              name="売上高"
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart data={salesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="orders" fill={theme.palette.primary.main} name="注文数" />
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ヘッダー */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            📈 Analytics Center
          </Typography>
          <Typography variant="body1" color="text.secondary">
            高度な分析とインサイトを提供します
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>期間</InputLabel>
            <Select
              value={timeRange}
              label="期間"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7d">7日間</MenuItem>
              <MenuItem value="30d">30日間</MenuItem>
              <MenuItem value="90d">90日間</MenuItem>
              <MenuItem value="1y">1年間</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            更新
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
          >
            エクスポート
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* KPI メトリクス */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="総売上"
            value="¥2,640,000"
            change={15.2}
            trend="up"
            icon={<TrendingUp />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="注文数"
            value={680}
            change={8.7}
            trend="up"
            icon={<BarChart />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="新規顧客"
            value={124}
            change={-3.2}
            trend="down"
            icon={<AnalyticsIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="コンバージョン率"
            value="2.8%"
            change={12.5}
            trend="up"
            icon={<ShowChart />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* メインチャート */}
        <Grid item xs={12} lg={8}>
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
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                売上トレンド
              </Typography>
              
              <Box display="flex" gap={1}>
                <Tooltip title="ラインチャート">
                  <IconButton
                    size="small"
                    color={chartType === 'line' ? 'primary' : 'default'}
                    onClick={() => setChartType('line')}
                    sx={{
                      backgroundColor: chartType === 'line' ? 'primary.main' : 'transparent',
                      color: chartType === 'line' ? 'white' : 'text.primary',
                      '&:hover': { backgroundColor: chartType === 'line' ? 'primary.dark' : 'grey.100' },
                    }}
                  >
                    <ShowChart />
                  </IconButton>
                </Tooltip>
                <Tooltip title="エリアチャート">
                  <IconButton
                    size="small"
                    color={chartType === 'area' ? 'primary' : 'default'}
                    onClick={() => setChartType('area')}
                    sx={{
                      backgroundColor: chartType === 'area' ? 'primary.main' : 'transparent',
                      color: chartType === 'area' ? 'white' : 'text.primary',
                      '&:hover': { backgroundColor: chartType === 'area' ? 'primary.dark' : 'grey.100' },
                    }}
                  >
                    <PieChart />
                  </IconButton>
                </Tooltip>
                <Tooltip title="バーチャート">
                  <IconButton
                    size="small"
                    color={chartType === 'bar' ? 'primary' : 'default'}
                    onClick={() => setChartType('bar')}
                    sx={{
                      backgroundColor: chartType === 'bar' ? 'primary.main' : 'transparent',
                      color: chartType === 'bar' ? 'white' : 'text.primary',
                      '&:hover': { backgroundColor: chartType === 'bar' ? 'primary.dark' : 'grey.100' },
                    }}
                  >
                    <BarChart />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {renderChart()}
          </Box>
        </Grid>

        {/* カテゴリ分布 */}
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
              カテゴリ別売上分布
            </Typography>
            
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </Box>
        </Grid>

        {/* トップ製品 */}
        <Grid item xs={12} md={6}>
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
              トップ製品
            </Typography>
            
            {productData.map((product, index) => (
              <Box key={index}>
                <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.orders} 注文
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      ¥{product.sales.toLocaleString()}
                    </Typography>
                    {product.trend === 'up' && (
                      <Box sx={{ 
                        backgroundColor: 'success.main', 
                        borderRadius: '50%', 
                        p: 0.5, 
                        display: 'flex', 
                        color: 'white' 
                      }}>
                        <TrendingUp fontSize="small" />
                      </Box>
                    )}
                    {product.trend === 'down' && (
                      <Box sx={{ 
                        backgroundColor: 'error.main', 
                        borderRadius: '50%', 
                        p: 0.5, 
                        display: 'flex', 
                        color: 'white' 
                      }}>
                        <TrendingDown fontSize="small" />
                      </Box>
                    )}
                  </Box>
                </Box>
                {index < productData.length - 1 && <Divider sx={{ my: 1 }} />}
              </Box>
            ))}
          </Box>
        </Grid>

        {/* 分析インサイト */}
        <Grid item xs={12} md={6}>
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
              🔍 分析インサイト
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Chip
                label="売上好調"
                color="success"
                size="small"
                sx={{ 
                  mr: 1, 
                  mb: 1,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Chip
                label="新規顧客増加"
                color="info"
                size="small"
                sx={{ 
                  mr: 1, 
                  mb: 1,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Chip
                label="要注意カテゴリ"
                color="warning"
                size="small"
                sx={{ 
                  mr: 1, 
                  mb: 1,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              />
            </Box>
            
            <Box sx={{ '& > *': { mb: 2 } }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  backgroundColor: 'success.main', 
                  mr: 1 
                }} />
                売上は前月比15.2%増と好調な成長を維持
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  backgroundColor: 'primary.main', 
                  mr: 1 
                }} />
                Electronics カテゴリが全体の35%を占め最大
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  backgroundColor: 'info.main', 
                  mr: 1 
                }} />
                新規顧客数は若干減少、リピート戦略が重要
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  backgroundColor: 'warning.main', 
                  mr: 1 
                }} />
                Product Cの売上が下降トレンド、要因分析が必要
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsCenter;