import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SpeedIcon from '@mui/icons-material/Speed';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { DashboardList } from '../../../frontend/src/features/dashboard/components/DashboardList/DashboardList';

interface AnalyticsDashboardProps {
  apiEndpoint?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  apiEndpoint = 'http://localhost:9001' 
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<any>(null);
  const [taskData, setTaskData] = useState<any>(null);
  const [resourceData, setResourceData] = useState<any>(null);
  const [showDashboardBuilder, setShowDashboardBuilder] = useState(false);

  const fetchAnalytics = async (type: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === 'conversations' 
        ? `${apiEndpoint}/api/analytics/conversations`
        : type === 'tasks'
        ? `${apiEndpoint}/api/analytics/tasks`
        : `${apiEndpoint}/api/analytics/analyze`;
        
      const options = type === 'resources' ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_type: 'resource_prediction',
          data: { historical_data: [] }
        })
      } : { method: 'GET' };
      
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        throw new Error(`分析データの取得に失敗しました: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (type === 'conversations') {
        setConversationData(data);
      } else if (type === 'tasks') {
        setTaskData(data);
      } else if (type === 'resources') {
        setResourceData(data);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初回ロード時に会話分析を取得
    fetchAnalytics('conversations');
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // タブに応じてデータを取得
    if (newValue === 0 && !conversationData) {
      fetchAnalytics('conversations');
    } else if (newValue === 1 && !taskData) {
      fetchAnalytics('tasks');
    } else if (newValue === 2 && !resourceData) {
      fetchAnalytics('resources');
    }
  };

  const handleDashboardSelect = (dashboard: any) => {
    // ダッシュボードが選択された時の処理
    console.log('Selected dashboard:', dashboard);
    // TODO: ダッシュボードビューアまたはエディターを開く
  };

  const handleCreateNew = () => {
    setShowDashboardBuilder(true);
  };

  const handleRefresh = () => {
    if (tabValue === 0) {
      fetchAnalytics('conversations');
    } else if (tabValue === 1) {
      fetchAnalytics('tasks');
    } else if (tabValue === 2) {
      fetchAnalytics('resources');
    }
  };

  const renderConversationAnalytics = () => {
    if (!conversationData?.analysis) return null;
    
    const analysis = conversationData.analysis;
    
    // トピック分布データ
    const topicData = Object.entries(analysis.topic_distribution || {}).map(([topic, count]) => ({
      name: topic,
      value: count as number
    }));
    
    // 時間帯別アクティビティ
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}時`,
      count: analysis.hourly_distribution?.[i] || 0
    }));
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                会話統計
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  総会話数
                </Typography>
                <Typography variant="h4">
                  {conversationData.total_conversations}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  平均応答時間
                </Typography>
                <Typography variant="h5">
                  {analysis.average_response_time?.toFixed(2) || 0}秒
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  最頻キーワード
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {Object.entries(analysis.frequent_keywords || {}).slice(0, 5).map(([keyword, count]) => (
                    <Chip 
                      key={keyword} 
                      label={`${keyword} (${count})`} 
                      size="small" 
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                トピック分布
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topicData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topicData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                時間帯別アクティビティ
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderTaskAnalytics = () => {
    if (!taskData?.analysis) return null;
    
    const analysis = taskData.analysis;
    
    // タスクタイプ別のデータ
    const taskTypeData = Object.entries(analysis.task_types || {}).map(([type, data]: [string, any]) => ({
      name: type,
      count: data.count,
      avgDuration: data.avg_duration
    }));
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                タスク統計
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  総タスク数
                </Typography>
                <Typography variant="h4">
                  {taskData.total_tasks}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  成功率
                </Typography>
                <Typography variant="h5" color="success.main">
                  {((analysis.success_rate || 0) * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  平均処理時間
                </Typography>
                <Typography variant="h5">
                  {analysis.average_duration?.toFixed(2) || 0}秒
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                タスクタイプ別パフォーマンス
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={taskTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="実行回数" />
                  <Bar yAxisId="right" dataKey="avgDuration" fill="#82ca9d" name="平均時間(秒)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                パフォーマンストレンド
              </Typography>
              <Box sx={{ mt: 2 }}>
                {analysis.performance_trend && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      現在のトレンド
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <TrendingUpIcon color="success" />
                      <Typography variant="body1" sx={{ ml: 1 }}>
                        {analysis.performance_trend}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderResourceAnalytics = () => {
    if (!resourceData?.result) return null;
    
    const prediction = resourceData.result.prediction || {};
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mb: 3 }}>
            リソース予測は過去のデータに基づいて将来のニーズを推定します
          </Alert>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                予測されるリソース需要
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  CPU使用率
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={prediction.cpu_usage || 0} 
                    sx={{ flexGrow: 1, mr: 2 }}
                  />
                  <Typography variant="body2">{prediction.cpu_usage || 0}%</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  メモリ使用率
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={prediction.memory_usage || 0} 
                    sx={{ flexGrow: 1, mr: 2 }}
                  />
                  <Typography variant="body2">{prediction.memory_usage || 0}%</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  推奨ワーカー数
                </Typography>
                <Typography variant="h5" sx={{ mt: 1 }}>
                  {prediction.recommended_workers || 3}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                最適化の提案
              </Typography>
              <Box sx={{ mt: 2 }}>
                {resourceData.result.recommendations?.map((rec: string, index: number) => (
                  <Alert severity="success" sx={{ mb: 2 }} key={index}>
                    {rec}
                  </Alert>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          分析ダッシュボード
        </Typography>
        <Tooltip title="更新">
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab 
            label="会話分析" 
            icon={<QueryStatsIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="タスク分析" 
            icon={<SpeedIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="リソース予測" 
            icon={<TrendingUpIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="ダッシュボード" 
            icon={<DashboardIcon />} 
            iconPosition="start"
          />
        </Tabs>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TabPanel value={tabValue} index={0}>
              {renderConversationAnalytics()}
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              {renderTaskAnalytics()}
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              {renderResourceAnalytics()}
            </TabPanel>
            <TabPanel value={tabValue} index={3}>
              <DashboardList
                onDashboardSelect={handleDashboardSelect}
                onCreateNew={handleCreateNew}
              />
            </TabPanel>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default AnalyticsDashboard;