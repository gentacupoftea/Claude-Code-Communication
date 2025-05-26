import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Chip
} from '@mui/material';
import SalesChart from '../components/DashboardCharts/SalesChart';
import ProductChart from '../components/DashboardCharts/ProductChart';
import CustomerStats from '../components/DashboardCharts/CustomerStats';
import { api } from '../services/api';

interface DashboardData {
  sales: {
    success: boolean;
    dates: string[];
    sales: number[];
    total: number;
    average: number;
    count: number;
  } | null;
  products: {
    success: boolean;
    products: Array<{
      name: string;
      quantity: number;
      revenue: number;
      average_price: number;
    }>;
  } | null;
  customers: {
    success: boolean;
    total: number;
    new: number;
    returning: number;
    topSpenders: Array<{
      name: string;
      totalSpent: number;
      ordersCount: number;
    }>;
  } | null;
}

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    sales: null,
    products: null,
    customers: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchAllData();
    // 30秒ごとに自動更新
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching dashboard data...');
      
      const [salesRes, productsRes, customersRes] = await Promise.all([
        api.get(`/api/analytics/sales?range=${dateRange}`),
        api.get('/api/analytics/products'),
        api.get('/api/analytics/customers')
      ]);

      const newData = {
        sales: salesRes,
        products: productsRes,
        customers: customersRes
      };

      setDashboardData(newData);

      console.log('Dashboard data updated:', newData);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          📊 リアルタイムダッシュボード
        </Typography>
        <Chip 
          label={`最終更新: ${new Date().toLocaleString('ja-JP')}`}
          color="primary"
          size="small"
        />
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>期間選択</InputLabel>
          <Select
            value={dateRange}
            label="期間選択"
            onChange={(e) => setDateRange(e.target.value)}
          >
            <MenuItem value="24h">過去24時間</MenuItem>
            <MenuItem value="7d">過去7日間</MenuItem>
            <MenuItem value="30d">過去30日間</MenuItem>
            <MenuItem value="90d">過去90日間</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>データを読み込み中...</Typography>
        </Box>
      ) : (
        <>
          {/* 統計サマリー */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    💰 総売上
                  </Typography>
                  <Typography variant="h4" component="div" color="primary">
                    {formatCurrency(dashboardData.sales?.total || 0)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    平均: {formatCurrency(dashboardData.sales?.average || 0)}/日
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    📦 注文数
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {dashboardData.sales?.count || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    期間中の総注文数
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    👥 顧客数
                  </Typography>
                  <Typography variant="h4" component="div" color="info.main">
                    {dashboardData.customers?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    新規: {dashboardData.customers?.new || 0}人
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* チャートエリア */}
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  📈 売上推移（実データ）
                </Typography>
                <SalesChart data={dashboardData.sales} dateRange={dateRange} />
              </Paper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  🏆 商品別売上TOP10
                </Typography>
                <ProductChart data={dashboardData.products} />
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  👤 顧客分析
                </Typography>
                <CustomerStats data={dashboardData.customers} />
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="textSecondary">
              🔄 30秒ごとに自動更新 | 最終更新: {new Date().toLocaleString('ja-JP')}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;