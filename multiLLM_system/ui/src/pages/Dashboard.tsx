import React, { useEffect, useState, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Memory,
  Speed,
  CheckCircle,
  Warning,
  Error,
  Refresh,
  PlayArrow,
  Group,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';

// Mock data - 実際の実装ではAPIから取得
const performanceData = [
  { time: '09:00', tasks: 45, latency: 120, success: 98 },
  { time: '10:00', tasks: 52, latency: 115, success: 97 },
  { time: '11:00', tasks: 48, latency: 130, success: 99 },
  { time: '12:00', tasks: 61, latency: 110, success: 96 },
  { time: '13:00', tasks: 38, latency: 125, success: 98 },
  { time: '14:00', tasks: 44, latency: 118, success: 99 },
  { time: '15:00', tasks: 56, latency: 112, success: 97 },
];

const workerUtilization = [
  { name: 'Backend Worker', utilization: 75, tasks: 156 },
  { name: 'Frontend Worker', utilization: 60, tasks: 89 },
  { name: 'Review Worker', utilization: 85, tasks: 203 },
  { name: 'Analytics Worker', utilization: 45, tasks: 67 },
];

const recentTasks = [
  { id: 'task-001', type: 'PR Review', status: 'completed', duration: '2.3s' },
  { id: 'task-002', type: 'Code Generation', status: 'running', duration: '5.1s' },
  { id: 'task-003', type: 'Bug Analysis', status: 'completed', duration: '1.8s' },
  { id: 'task-004', type: 'Documentation', status: 'completed', duration: '3.2s' },
  { id: 'task-005', type: 'Image Generation', status: 'running', duration: '8.5s' },
];

const systemAlerts = [
  { type: 'warning', message: 'Worker 3のメモリ使用率が80%を超えています' },
  { type: 'info', message: 'OpenMemory同期が正常に完了しました' },
  { type: 'success', message: 'GitHub Webhook統合が稼働中です' },
];

const Dashboard: React.FC = () => {
  const [refreshTime, setRefreshTime] = useState(new Date());
  const dispatch = useDispatch();
  
  // Redux state
  const systemStatus = useSelector((state: RootState) => state.system.status);
  const activeWorkers = useSelector((state: RootState) => state.workers.activeCount);
  const activeTasks = useSelector((state: RootState) => state.tasks.activeCount);
  const completedTasks = useSelector((state: RootState) => state.tasks.completedCount);
  const systemUptime = useSelector((state: RootState) => state.system.uptime);
  
  // Memoized calculations
  const memoizedPerformanceData = useMemo(() => performanceData, []);
  const memoizedWorkerUtilization = useMemo(() => workerUtilization, []);
  const memoizedRecentTasks = useMemo(() => recentTasks, []);

  const handleRefresh = () => {
    setRefreshTime(new Date());
    // ここで実際のデータ更新処理を実行
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'running': return <PlayArrow color="primary" />;
      case 'error': return <Error color="error" />;
      default: return <Warning color="warning" />;
    }
  };

  const getAlertSeverity = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          ダッシュボード
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            最終更新: {refreshTime.toLocaleTimeString()}
          </Typography>
          <IconButton onClick={handleRefresh} size="small">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* System Alerts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {systemAlerts.map((alert, index) => (
              <Alert 
                key={index} 
                severity={getAlertSeverity(alert.type) as any}
                sx={{ borderRadius: 2 }}
              >
                {alert.message}
              </Alert>
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    アクティブWorker
                  </Typography>
                  <Typography variant="h4">
                    {activeWorkers}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +2 from yesterday
                  </Typography>
                </Box>
                <Group sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    実行中タスク
                  </Typography>
                  <Typography variant="h4">
                    {activeTasks}
                  </Typography>
                  <Typography variant="body2" color="primary.main">
                    Processing...
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    完了タスク（今日）
                  </Typography>
                  <Typography variant="h4">
                    {completedTasks}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    98.5% success rate
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    稼働時間
                  </Typography>
                  <Typography variant="h4">
                    {systemUptime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Since last restart
                  </Typography>
                </Box>
                <Speed sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                パフォーマンス推移
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="tasks" 
                    stroke="#1976d2" 
                    strokeWidth={2}
                    name="Tasks/Hour"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#dc004e" 
                    strokeWidth={2}
                    name="Latency (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Worker使用率
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workerUtilization} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="utilization" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                最近のタスク
              </Typography>
              <List dense>
                {recentTasks.map((task, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      {getStatusIcon(task.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${task.type} (${task.id})`}
                      secondary={`Duration: ${task.duration}`}
                    />
                    <Chip 
                      label={task.status} 
                      size="small"
                      color={task.status === 'completed' ? 'success' : 'primary'}
                      variant={task.status === 'running' ? 'filled' : 'outlined'}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Worker詳細
              </Typography>
              <List dense>
                {workerUtilization.map((worker, index) => (
                  <ListItem key={index} sx={{ px: 0, flexDirection: 'column', alignItems: 'stretch' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                      <Typography variant="body2">
                        {worker.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {worker.utilization}% ({worker.tasks} tasks)
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={worker.utilization}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          backgroundColor: worker.utilization > 80 ? 'error.main' : 'primary.main'
                        }
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;