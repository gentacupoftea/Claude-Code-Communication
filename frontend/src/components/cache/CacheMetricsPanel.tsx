import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Skeleton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Dataset as DatasetIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useCacheMetrics } from '../../hooks/useCacheMetrics';
import { formatBytes, formatDuration } from '../../utils/format';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  secondaryValue?: string;
  loading?: boolean;
  color?: string;
}

// メトリクスカードコンポーネント
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  secondaryValue,
  loading,
  color = 'primary.main'
}) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Box
            sx={{
              backgroundColor: color,
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
          <>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {secondaryValue && (
              <Typography variant="caption" color="textSecondary">
                {secondaryValue}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ヒットレートプログレスコンポーネント
const HitRateProgress: React.FC<{ hitRate: number; loading: boolean }> = ({ hitRate, loading }) => {
  const { t } = useTranslation();
  
  // ヒットレートに基づいて色を決定
  const getColor = (rate: number) => {
    if (rate >= 80) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  };
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">{t('cache.hitRate')}</Typography>
          <Tooltip title={t('cache.hitRateDescription')}>
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        {loading ? (
          <Box>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rectangular" height={10} sx={{ mt: 1 }} />
          </Box>
        ) : (
          <Box>
            <Typography variant="h4" fontWeight="bold" mb={1}>
              {hitRate.toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={hitRate}
              color={getColor(hitRate)}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// トップキャッシュエンドポイントコンポーネント
const TopCachedEndpoints: React.FC<{
  endpoints: Array<{
    endpoint: string;
    hits: number;
    hitRate: number;
    avgSizeBytes: number;
  }>;
  loading: boolean;
}> = ({ endpoints, loading }) => {
  const { t } = useTranslation();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {t('cache.topEndpoints')}
        </Typography>
        
        {loading ? (
          <Skeleton variant="rectangular" width="100%" height={250} />
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 250 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t('cache.endpoint')}</TableCell>
                  <TableCell align="right">{t('cache.hits')}</TableCell>
                  <TableCell align="right">{t('cache.hitRate')}</TableCell>
                  <TableCell align="right">{t('cache.avgSize')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.endpoint}>
                    <TableCell component="th" scope="row" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={endpoint.endpoint}>
                        <span>{endpoint.endpoint}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">{endpoint.hits.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`${endpoint.hitRate.toFixed(1)}%`}
                        color={endpoint.hitRate >= 80 ? 'success' : endpoint.hitRate >= 50 ? 'warning' : 'error'}
                      />
                    </TableCell>
                    <TableCell align="right">{formatBytes(endpoint.avgSizeBytes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

// プラットフォーム別効率チャートコンポーネント
const PlatformEfficiencyChart: React.FC<{
  data: Record<string, { hitRate: number; totalRequests: number }>;
  loading: boolean;
}> = ({ data, loading }) => {
  const { t } = useTranslation();
  
  // チャート用にデータを加工
  const chartData = Object.entries(data).map(([platform, stats]) => ({
    name: platform,
    hitRate: stats.hitRate,
    requests: stats.totalRequests
  }));
  
  // 色配列
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {t('cache.platformEfficiency')}
        </Typography>
        
        {loading ? (
          <Skeleton variant="rectangular" width="100%" height={250} />
        ) : (
          <Box sx={{ height: 250, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#8884d8"
                  domain={[0, 100]}
                  label={{ value: 'ヒット率 (%)', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#82ca9d"
                  label={{ value: 'リクエスト数', angle: 90, position: 'insideRight' }}
                />
                <RechartsTooltip />
                <Bar yAxisId="left" dataKey="hitRate" fill="#8884d8" name="ヒット率 (%)" />
                <Bar yAxisId="right" dataKey="requests" fill="#82ca9d" name="リクエスト数" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * キャッシュメトリクスパネルコンポーネント
 */
const CacheMetricsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [refreshIntervalValue, setRefreshIntervalValue] = useState<number>(0);
  
  const {
    metrics,
    loading,
    error,
    refresh,
    refreshInterval,
    setRefreshInterval
  } = useCacheMetrics(refreshIntervalValue);
  
  // 自動更新間隔の変更
  const handleRefreshIntervalChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setRefreshIntervalValue(value);
    setRefreshInterval(value);
  };
  
  // 手動更新
  const handleRefresh = () => {
    refresh();
  };
  
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          {t('cache.metricsTitle')}
        </Typography>
        
        <Box display="flex" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180, mr: 1 }}>
            <InputLabel id="refresh-interval-label">{t('cache.autoRefresh')}</InputLabel>
            <Select
              labelId="refresh-interval-label"
              value={refreshIntervalValue}
              label={t('cache.autoRefresh')}
              onChange={handleRefreshIntervalChange}
            >
              <MenuItem value={0}>{t('cache.refreshDisabled')}</MenuItem>
              <MenuItem value={10}>{t('cache.refreshEvery', { seconds: 10 })}</MenuItem>
              <MenuItem value={30}>{t('cache.refreshEvery', { seconds: 30 })}</MenuItem>
              <MenuItem value={60}>{t('cache.refreshEvery', { seconds: 60 })}</MenuItem>
              <MenuItem value={300}>{t('cache.refreshEvery', { seconds: 300 })}</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            size="small"
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
      
      {/* 主要メトリクス */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title={t('cache.requests')}
            value={metrics?.totalRequests.toLocaleString() || '0'}
            icon={<SpeedIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title={t('cache.itemCount')}
            value={metrics?.itemCount.toLocaleString() || '0'}
            icon={<DatasetIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title={t('cache.memoryUsage')}
            value={metrics ? formatBytes(metrics.sizeBytes) : '0 B'}
            secondaryValue={metrics ? `${metrics.memoryUsagePercentage.toFixed(1)}% ${t('cache.used')}` : ''}
            icon={<MemoryIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title={t('cache.responseTime')}
            value={metrics ? `${metrics.avgResponseTimeMs.toFixed(1)} ms` : '0 ms'}
            icon={<StorageIcon sx={{ color: 'white' }} />}
            loading={loading}
          />
        </Grid>
      </Grid>
      
      {/* ヒットレートとパフォーマンス */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <HitRateProgress
            hitRate={metrics?.hitRate || 0}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                {t('cache.cacheEfficiency')}
              </Typography>
              
              {loading ? (
                <Skeleton variant="rectangular" width="100%" height={200} />
              ) : (
                <Box sx={{ height: 200, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('cache.hits'), value: metrics?.totalHits || 0 },
                          { name: t('cache.misses'), value: metrics?.totalMisses || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#4caf50" />
                        <Cell fill="#f44336" />
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => [value.toLocaleString(), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* 詳細メトリクス */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TopCachedEndpoints
            endpoints={metrics?.topCachedEndpoints || []}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <PlatformEfficiencyChart
            data={metrics?.cacheEfficiencyByPlatform || {}}
            loading={loading}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default CacheMetricsPanel;