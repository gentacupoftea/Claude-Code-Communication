import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  TextField,
  Button
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useDashboardContext } from '../hooks/useDashboardContext';
import RefreshIcon from '@mui/icons-material/Refresh';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DateFilteredChartProps {
  dashboardId: string;
  defaultQuery?: string;
  title?: string;
  chartType?: 'bar' | 'line' | 'pie';
}

export const DateFilteredChart: React.FC<DateFilteredChartProps> = ({
  dashboardId,
  defaultQuery = '',
  title = 'データ分析',
  chartType: initialChartType = 'bar'
}) => {
  const { context, loading, executeQuery, onDateRangeChange } = useDashboardContext(dashboardId);
  const [query, setQuery] = useState(defaultQuery);
  const [chartType, setChartType] = useState(initialChartType);
  const [chartData, setChartData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // データを取得
  const fetchData = async () => {
    if (!query.trim()) return;

    try {
      setError(null);
      const result = await executeQuery(query, chartType);
      
      if (result.success) {
        // Chart.js形式にデータを変換
        const formattedData = formatChartData(result.data, chartType);
        setChartData(formattedData);
      } else {
        setError('データの取得に失敗しました');
      }
    } catch (err) {
      setError('データの取得中にエラーが発生しました');
      console.error('Fetch data error:', err);
    }
  };

  // Chart.js用のデータフォーマット
  const formatChartData = (data: any[], type: string) => {
    if (!data || data.length === 0) return null;

    const labels = data.map(item => 
      item.date || item.month || item.label || item.name || 'Unknown'
    );
    const values = data.map(item => 
      item.value || item.count || item.total || 0
    );

    const baseConfig = {
      labels,
      datasets: [{
        label: title,
        data: values,
        backgroundColor: type === 'pie' 
          ? generateColors(data.length)
          : 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };

    return baseConfig;
  };

  // 色のパレットを生成
  const generateColors = (count: number) => {
    const colors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 205, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)'
    ];
    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  };

  // チャートコンポーネントを取得
  const getChartComponent = () => {
    if (!chartData) return null;

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `${title} ${context.dateRange.startDate ? 
            `(${context.dateRange.startDate} - ${context.dateRange.endDate})` : 
            ''}`
        },
      },
    };

    switch (chartType) {
      case 'line':
        return <Line data={chartData} options={options} />;
      case 'pie':
        return <Pie data={chartData} options={options} />;
      default:
        return <Bar data={chartData} options={options} />;
    }
  };

  // 初期データ読み込み
  useEffect(() => {
    if (defaultQuery) {
      fetchData();
    }
  }, [context.dateRange]); // 日付範囲が変わったら再取得

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        <Box mb={2}>
          <TextField
            fullWidth
            label="クエリ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: 売上データを表示"
            size="small"
            sx={{ mb: 1 }}
          />
          
          <Box display="flex" gap={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>チャートタイプ</InputLabel>
              <Select
                value={chartType}
                label="チャートタイプ"
                onChange={(e) => setChartType(e.target.value as any)}
              >
                <MenuItem value="bar">棒グラフ</MenuItem>
                <MenuItem value="line">線グラフ</MenuItem>
                <MenuItem value="pie">円グラフ</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={fetchData}
              disabled={loading || !query.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              実行
            </Button>
          </Box>
        </Box>

        {context.dateRange.startDate && (
          <Alert severity="info" sx={{ mb: 2 }}>
            日付フィルター適用中: {context.dateRange.startDate} - {context.dateRange.endDate}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {chartData && !loading && (
          <Box height={400}>
            {getChartComponent()}
          </Box>
        )}

        {!chartData && !loading && !error && query && (
          <Typography color="text.secondary" align="center" sx={{ p: 3 }}>
            データがありません
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};