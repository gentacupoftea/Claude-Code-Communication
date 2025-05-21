/**
 * 分析サマリーコンポーネント
 * 
 * データ分析の主要な洞察と概要を表示するためのコンポーネント
 */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Button,
  LinearProgress,
  Alert,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ArrowUpward,
  ArrowDownward,
  ArrowForward,
  FileDownload,
  ZoomIn,
  Star,
  StarOutline,
  FilterList,
  BarChart,
  AddCircleOutline,
  RemoveCircleOutline,
} from '@mui/icons-material';

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning' | 'info';
  metric?: string;
  value?: number | string;
  previousValue?: number | string;
  percentChange?: number;
  trend?: 'up' | 'down' | 'stable';
  priority: 'high' | 'medium' | 'low';
  source?: string;
  timestamp?: Date;
  segmentName?: string;
  isPinned?: boolean;
}

export interface MetricSummary {
  name: string;
  value: number;
  unit?: string;
  previousValue?: number;
  percentChange?: number;
  trend?: 'up' | 'down' | 'stable';
  isPositive?: boolean;
  detailLink?: string;
}

export interface SegmentHighlight {
  segmentType: string;
  segmentName: string;
  metricName: string;
  value: number;
  unit?: string;
  percentChange?: number;
  trend?: 'up' | 'down' | 'stable';
  isPositive?: boolean;
}

export interface AnalyticsSummaryProps {
  title?: string;
  subtitle?: string;
  dateRange?: { start: Date; end: Date };
  insights: Insight[];
  keyMetrics?: MetricSummary[];
  topSegments?: SegmentHighlight[];
  showInsights?: boolean;
  showMetrics?: boolean;
  showSegments?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onInsightPin?: (insightId: string) => void;
  onExport?: () => void;
  className?: string;
}

const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({
  title = '分析サマリー',
  subtitle,
  dateRange,
  insights = [],
  keyMetrics = [],
  topSegments = [],
  showInsights = true,
  showMetrics = true,
  showSegments = true,
  isLoading = false,
  error = null,
  onInsightPin,
  onExport,
  className,
}) => {
  const theme = useTheme();
  
  // インサイトの種類によってアイコンを選択
  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return <CheckCircle color="success" />;
      case 'negative':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };
  
  // トレンドを表示するコンポーネント
  const renderTrend = (
    percentChange?: number,
    trend?: 'up' | 'down' | 'stable',
    isPositive?: boolean
  ) => {
    if (percentChange === undefined && trend === undefined) return null;
    
    const actualTrend = trend || (percentChange && percentChange > 0 ? 'up' : percentChange! < 0 ? 'down' : 'stable');
    const displayPercentage = percentChange ? Math.abs(percentChange).toFixed(1) + '%' : '';
    
    let color;
    if (isPositive !== undefined) {
      // 明示的に指定されている場合はそれに従う
      color = isPositive ? 'success.main' : 'error.main';
    } else {
      // デフォルトは上昇=良い、下降=悪い
      color = actualTrend === 'up' ? 'success.main' : actualTrend === 'down' ? 'error.main' : 'text.secondary';
    }
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', color }}>
        {actualTrend === 'up' ? (
          <ArrowUpward fontSize="small" />
        ) : actualTrend === 'down' ? (
          <ArrowDownward fontSize="small" />
        ) : (
          <ArrowForward fontSize="small" />
        )}
        <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 'medium' }}>
          {displayPercentage}
        </Typography>
      </Box>
    );
  };
  
  // メトリクスカードを表示
  const renderMetricsCards = () => {
    if (!showMetrics || keyMetrics.length === 0) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          主要メトリクス
        </Typography>
        
        <Grid container spacing={2}>
          {keyMetrics.map((metric, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {metric.name}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Typography variant="h4">
                      {typeof metric.value === 'number'
                        ? new Intl.NumberFormat('ja-JP').format(metric.value)
                        : metric.value}
                      {metric.unit && (
                        <Typography component="span" variant="body2" sx={{ ml: 0.5 }}>
                          {metric.unit}
                        </Typography>
                      )}
                    </Typography>
                    
                    {renderTrend(metric.percentChange, metric.trend, metric.isPositive)}
                  </Box>
                  
                  {metric.detailLink && (
                    <Box sx={{ mt: 1, textAlign: 'right' }}>
                      <Tooltip title="詳細を表示">
                        <IconButton size="small">
                          <ZoomIn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };
  
  // インサイトリストを表示
  const renderInsights = () => {
    if (!showInsights || insights.length === 0) return null;
    
    // 優先度でソート
    const sortedInsights = [...insights].sort((a, b) => {
      const priorityValues = { high: 0, medium: 1, low: 2 };
      return priorityValues[a.priority] - priorityValues[b.priority];
    });
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          インサイト
        </Typography>
        
        <List>
          {sortedInsights.map((insight) => (
            <Paper
              key={insight.id}
              variant="outlined"
              sx={{
                mb: 2,
                borderLeft: '4px solid',
                borderLeftColor:
                  insight.type === 'positive'
                    ? 'success.main'
                    : insight.type === 'negative'
                    ? 'error.main'
                    : insight.type === 'warning'
                    ? 'warning.main'
                    : 'info.main',
              }}
            >
              <ListItem
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  p: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getInsightIcon(insight.type)}
                  </ListItemIcon>
                  
                  <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                    {insight.title}
                  </Typography>
                  
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {insight.priority === 'high' && (
                      <Chip label="重要" size="small" color="error" />
                    )}
                    
                    {onInsightPin && (
                      <Tooltip title={insight.isPinned ? "ピン留めを解除" : "ピン留めする"}>
                        <IconButton
                          size="small"
                          onClick={() => onInsightPin(insight.id)}
                        >
                          {insight.isPinned ? (
                            <Star fontSize="small" color="primary" />
                          ) : (
                            <StarOutline fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
                
                <Typography variant="body2" sx={{ pl: 5, color: 'text.secondary' }}>
                  {insight.description}
                </Typography>
                
                {insight.value !== undefined && (
                  <Box sx={{ display: 'flex', alignItems: 'center', pl: 5, mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {insight.metric}: {insight.value}
                    </Typography>
                    
                    {renderTrend(
                      insight.percentChange,
                      insight.trend,
                      insight.type === 'positive'
                    )}
                  </Box>
                )}
                
                {insight.segmentName && (
                  <Box sx={{ pl: 5 }}>
                    <Chip
                      label={insight.segmentName}
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}
              </ListItem>
            </Paper>
          ))}
        </List>
      </Box>
    );
  };
  
  // セグメントのハイライトを表示
  const renderSegmentHighlights = () => {
    if (!showSegments || topSegments.length === 0) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          トップセグメント
        </Typography>
        
        <Grid container spacing={2}>
          {topSegments.map((segment, index) => (
            <Grid item xs={12} sm={6} key={index}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {segment.segmentType}: {segment.segmentName}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography variant="h6">
                    {typeof segment.value === 'number'
                      ? new Intl.NumberFormat('ja-JP').format(segment.value)
                      : segment.value}
                    {segment.unit && (
                      <Typography component="span" variant="body2" sx={{ ml: 0.5 }}>
                        {segment.unit}
                      </Typography>
                    )}
                  </Typography>
                  
                  {renderTrend(segment.percentChange, segment.trend, segment.isPositive)}
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  {segment.metricName}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };
  
  return (
    <Box className={className}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5">{title}</Typography>
          
          {onExport && (
            <Button
              startIcon={<FileDownload />}
              variant="outlined"
              size="small"
              onClick={onExport}
            >
              エクスポート
            </Button>
          )}
        </Box>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        
        {dateRange && (
          <Typography variant="body2" color="text.secondary">
            期間: {dateRange.start.toLocaleDateString()} 〜 {dateRange.end.toLocaleDateString()}
          </Typography>
        )}
      </Box>
      
      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* ローディング表示 */}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      
      {/* コンテンツ */}
      {!isLoading && !error && (
        <>
          {/* メトリクスカード */}
          {renderMetricsCards()}
          
          {/* インサイト */}
          {renderInsights()}
          
          {/* セグメントハイライト */}
          {renderSegmentHighlights()}
        </>
      )}
    </Box>
  );
};

export default AnalyticsSummary;