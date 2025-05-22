/**
 * 分析チャートセレクターコンポーネント
 * 
 * 様々な分析チャートタイプを選択して表示するためのコンポーネント
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardHeader,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  Chip,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon,
  BubbleChart as BubbleChartIcon,
  DonutLarge as DonutChartIcon,
  TableChart as TableChartIcon,
  Map as MapIcon,
  Download,
  Settings,
  Fullscreen,
  Save,
  Refresh,
  Info,
} from '@mui/icons-material';
import { CategoryPieChart, SalesTrendChart } from '../../charts';
import { useTheme } from '@mui/material/styles';

// チャートタイプ
type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'donut'
  | 'area'
  | 'bubble'
  | 'scatter'
  | 'heatmap'
  | 'radar'
  | 'table'
  | 'map';

// データ期間
type DateRange =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

// チャート比較モード
type ComparisonMode =
  | 'none'
  | 'previousPeriod'
  | 'previousYear'
  | 'custom';

// データ粒度
type DataGranularity =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

interface ChartSelectorProps {
  title?: string;
  defaultChartType?: ChartType;
  availableChartTypes?: ChartType[];
  showDataControls?: boolean;
  showChartControls?: boolean;
  showExportControls?: boolean;
  fullWidth?: boolean;
  height?: number | string;
  className?: string;
  onTypeChange?: (type: ChartType) => void;
  onDateRangeChange?: (range: DateRange) => void;
  onRefresh?: () => void;
  onExport?: (format: string) => void;
  isLoading?: boolean;
}

const AnalyticsChartSelector: React.FC<ChartSelectorProps> = ({
  title = 'データ分析',
  defaultChartType = 'bar',
  availableChartTypes = ['bar', 'line', 'pie', 'donut', 'area', 'table'],
  showDataControls = true,
  showChartControls = true,
  showExportControls = true,
  fullWidth = true,
  height = 400,
  className,
  onTypeChange,
  onDateRangeChange,
  onRefresh,
  onExport,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [dateRange, setDateRange] = useState<DateRange>('last30days');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none');
  const [granularity, setGranularity] = useState<DataGranularity>('day');
  const [showLegend, setShowLegend] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  
  // チャートタイプのアイコンマップ
  const chartIconMap: Record<ChartType, React.ReactElement> = {
    bar: <BarChartIcon />,
    line: <LineChartIcon />,
    pie: <PieChartIcon />,
    donut: <DonutChartIcon />,
    area: <LineChartIcon />,
    bubble: <BubbleChartIcon />,
    scatter: <BubbleChartIcon />,
    heatmap: <BubbleChartIcon />,
    radar: <DonutChartIcon />,
    table: <TableChartIcon />,
    map: <MapIcon />,
  };
  
  // チャートタイプ変更ハンドラー
  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    if (onTypeChange) {
      onTypeChange(type);
    }
  };
  
  // 日付範囲変更ハンドラー
  const handleDateRangeChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const value = event.target.value as DateRange;
    setDateRange(value);
    if (onDateRangeChange) {
      onDateRangeChange(value);
    }
  };
  
  // データ粒度変更ハンドラー
  const handleGranularityChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setGranularity(event.target.value as DataGranularity);
  };
  
  // 比較モード変更ハンドラー
  const handleComparisonModeChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setComparisonMode(event.target.value as ComparisonMode);
  };
  
  // エクスポートハンドラー
  const handleExport = (format: string) => {
    if (onExport) {
      onExport(format);
    }
  };
  
  // 現在のチャートを描画
  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return <SalesTrendChart chartType="bar" height={Number(height) - 150} />;
      case 'line':
        return <SalesTrendChart chartType="line" height={Number(height) - 150} />;
      case 'area':
        return <SalesTrendChart chartType="area" height={Number(height) - 150} />;
      case 'pie':
        return <CategoryPieChart chartType="pie" height={Number(height) - 150} />;
      case 'donut':
        return <CategoryPieChart chartType="donut" height={Number(height) - 150} />;
      default:
        return (
          <Box
            sx={{
              height: Number(height) - 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              {chartType}チャートはプレビューでは利用できません
            </Typography>
          </Box>
        );
    }
  };
  
  return (
    <Card
      sx={{
        width: fullWidth ? '100%' : 'auto',
        height: height,
        overflow: 'hidden',
      }}
      className={className}
      elevation={0}
      variant="outlined"
    >
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6">{title}</Typography>
            <Tooltip title="グラフについての詳細情報">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {showExportControls && (
              <>
                <Tooltip title="グラフを保存">
                  <IconButton size="small" onClick={() => handleExport('image')}>
                    <Save fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="データをエクスポート">
                  <IconButton size="small" onClick={() => handleExport('data')}>
                    <Download fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title="拡大表示">
              <IconButton size="small">
                <Fullscreen fontSize="small" />
              </IconButton>
            </Tooltip>
            {onRefresh && (
              <Tooltip title="データを更新">
                <IconButton size="small" onClick={onRefresh}>
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {showChartControls && (
              <Tooltip title="グラフ設定">
                <IconButton size="small">
                  <Settings fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
        sx={{ pb: 0 }}
      />
      
      {showDataControls && (
        <Box sx={{ px: 2, py: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>期間</InputLabel>
                <Select
                  value={dateRange}
                  onChange={handleDateRangeChange as any}
                  label="期間"
                >
                  <MenuItem value="today">今日</MenuItem>
                  <MenuItem value="yesterday">昨日</MenuItem>
                  <MenuItem value="last7days">過去7日間</MenuItem>
                  <MenuItem value="last30days">過去30日間</MenuItem>
                  <MenuItem value="thisMonth">今月</MenuItem>
                  <MenuItem value="lastMonth">先月</MenuItem>
                  <MenuItem value="thisQuarter">今四半期</MenuItem>
                  <MenuItem value="thisYear">今年</MenuItem>
                  <MenuItem value="lastYear">昨年</MenuItem>
                  <MenuItem value="custom">カスタム...</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>比較</InputLabel>
                <Select
                  value={comparisonMode}
                  onChange={handleComparisonModeChange as any}
                  label="比較"
                >
                  <MenuItem value="none">なし</MenuItem>
                  <MenuItem value="previousPeriod">前期間</MenuItem>
                  <MenuItem value="previousYear">前年同期</MenuItem>
                  <MenuItem value="custom">カスタム...</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>粒度</InputLabel>
                <Select
                  value={granularity}
                  onChange={handleGranularityChange as any}
                  label="粒度"
                >
                  <MenuItem value="hour">時間単位</MenuItem>
                  <MenuItem value="day">日単位</MenuItem>
                  <MenuItem value="week">週単位</MenuItem>
                  <MenuItem value="month">月単位</MenuItem>
                  <MenuItem value="quarter">四半期単位</MenuItem>
                  <MenuItem value="year">年単位</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}
      
      {showChartControls && (
        <Box sx={{ px: 2, pt: 1, pb: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {availableChartTypes.map((type) => (
              <Tooltip key={type} title={`${type}チャート`}>
                <Chip
                  icon={chartIconMap[type]}
                  label={type}
                  onClick={() => handleChartTypeChange(type)}
                  color={chartType === type ? 'primary' : 'default'}
                  variant={chartType === type ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ 
                    textTransform: 'capitalize',
                    '& .MuiChip-icon': { mr: -0.5 }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  size="small"
                />
              }
              label="凡例"
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showValues}
                  onChange={(e) => setShowValues(e.target.checked)}
                  size="small"
                />
              }
              label="値"
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showGridLines}
                  onChange={(e) => setShowGridLines(e.target.checked)}
                  size="small"
                />
              }
              label="グリッド"
              sx={{ m: 0 }}
            />
          </Box>
        </Box>
      )}
      
      <Divider sx={{ mt: 1 }} />
      
      <CardContent sx={{ pt: 2, pb: '16px !important', height: 'calc(100% - 135px)' }}>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default AnalyticsChartSelector;