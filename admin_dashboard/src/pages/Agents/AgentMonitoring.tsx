/**
 * AI Agent Monitoring - エージェント監視・管理ページ
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Tab,
  Tabs,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Slider,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Psychology as ClaudeIcon,
  SmartToy as OpenAIIcon,
  AutoAwesome as GeminiIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  BugReport as ErrorIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Tune as TuneIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

interface AgentStatus {
  id: string;
  name: string;
  provider: 'claude' | 'openai' | 'gemini';
  status: 'active' | 'idle' | 'error' | 'stopped';
  currentTask?: string;
  uptime: string;
  requestsToday: number;
  avgResponseTime: number;
  successRate: number;
  errorCount: number;
  lastActivity: string;
  memoryUsage: number;
  cpuUsage: number;
  configuration: {
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
  };
}

interface Task {
  id: string;
  type: string;
  description: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  cost: number;
  tokens: number;
}

const AgentMonitoring: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<AgentStatus['configuration']>({
    model: '',
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 30,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  useEffect(() => {
    loadAgentData();
    loadTaskData();
    
    // リアルタイム更新をシミュレート
    const interval = setInterval(() => {
      updateRealTimeData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadAgentData = () => {
    // Mock data - 実際の実装では API から取得
    const mockAgents: AgentStatus[] = [
      {
        id: 'claude-1',
        name: 'Claude Analysis Agent',
        provider: 'claude',
        status: 'active',
        currentTask: 'Strategic analysis for Q1 planning',
        uptime: '24h 15m',
        requestsToday: 156,
        avgResponseTime: 2.3,
        successRate: 98.5,
        errorCount: 2,
        lastActivity: '2 minutes ago',
        memoryUsage: 45,
        cpuUsage: 23,
        configuration: {
          model: 'claude-3-sonnet',
          temperature: 0.3,
          maxTokens: 8000,
          timeout: 45,
        },
      },
      {
        id: 'openai-1',
        name: 'OpenAI Code Agent',
        provider: 'openai',
        status: 'active',
        currentTask: 'Code review for PR #123',
        uptime: '18h 42m',
        requestsToday: 203,
        avgResponseTime: 1.8,
        successRate: 96.2,
        errorCount: 8,
        lastActivity: '5 minutes ago',
        memoryUsage: 38,
        cpuUsage: 31,
        configuration: {
          model: 'gpt-4-turbo',
          temperature: 0.2,
          maxTokens: 6000,
          timeout: 30,
        },
      },
      {
        id: 'gemini-1',
        name: 'Gemini Infrastructure Agent',
        provider: 'gemini',
        status: 'idle',
        uptime: '12h 8m',
        requestsToday: 89,
        avgResponseTime: 2.1,
        successRate: 94.7,
        errorCount: 4,
        lastActivity: '15 minutes ago',
        memoryUsage: 22,
        cpuUsage: 12,
        configuration: {
          model: 'gemini-pro',
          temperature: 0.1,
          maxTokens: 4000,
          timeout: 25,
        },
      },
    ];
    
    setAgents(mockAgents);
  };

  const loadTaskData = () => {
    // Mock task data
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        type: 'code_generation',
        description: 'Generate React component for user profile',
        agentId: 'openai-1',
        status: 'completed',
        startTime: '10:30 AM',
        endTime: '10:32 AM',
        duration: 2.3,
        cost: 0.0234,
        tokens: 1250,
      },
      {
        id: 'task-2',
        type: 'strategic_analysis',
        description: 'Analyze market trends for Q1 strategy',
        agentId: 'claude-1',
        status: 'running',
        startTime: '10:45 AM',
        cost: 0.0156,
        tokens: 890,
      },
      {
        id: 'task-3',
        type: 'deployment',
        description: 'Deploy infrastructure to production',
        agentId: 'gemini-1',
        status: 'pending',
        startTime: '',
        cost: 0,
        tokens: 0,
      },
    ];
    
    setTasks(mockTasks);
  };

  const updateRealTimeData = () => {
    // リアルタイムデータ更新をシミュレート
    setAgents(prev => prev.map(agent => ({
      ...agent,
      requestsToday: agent.requestsToday + Math.floor(Math.random() * 3),
      avgResponseTime: Math.max(1, agent.avgResponseTime + (Math.random() - 0.5) * 0.2),
      memoryUsage: Math.max(10, Math.min(80, agent.memoryUsage + (Math.random() - 0.5) * 5)),
      cpuUsage: Math.max(5, Math.min(60, agent.cpuUsage + (Math.random() - 0.5) * 8)),
    })));
  };

  const handleAgentToggle = (agentId: string, newStatus: 'active' | 'stopped') => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, status: newStatus }
        : agent
    ));
    
    showSnackbar(
      `Agent ${newStatus === 'active' ? 'started' : 'stopped'} successfully`,
      'success'
    );
  };

  const handleConfigSave = () => {
    if (!selectedAgent) return;
    
    setAgents(prev => prev.map(agent => 
      agent.id === selectedAgent 
        ? { ...agent, configuration: tempConfig }
        : agent
    ));
    
    setConfigDialogOpen(false);
    setSelectedAgent(null);
    showSnackbar('Configuration updated successfully', 'success');
  };

  const openConfigDialog = (agent: AgentStatus) => {
    setSelectedAgent(agent.id);
    setTempConfig(agent.configuration);
    setConfigDialogOpen(true);
  };

  const getAgentIcon = (provider: string) => {
    switch (provider) {
      case 'claude':
        return <ClaudeIcon sx={{ color: '#ff6b35' }} />;
      case 'openai':
        return <OpenAIIcon sx={{ color: '#00a67e' }} />;
      case 'gemini':
        return <GeminiIcon sx={{ color: '#4285f4' }} />;
      default:
        return <ClaudeIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'idle':
        return 'warning';
      case 'error':
        return 'error';
      case 'stopped':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'running':
        return <TrendingUpIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon />;
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          🤖 AI Agent Monitoring
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            loadAgentData();
            loadTaskData();
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<ClaudeIcon />} label="Agent Status" />
          <Tab icon={<ChartIcon />} label="Task Queue" />
          <Tab icon={<SpeedIcon />} label="Performance" />
          <Tab icon={<SettingsIcon />} label="Configuration" />
        </Tabs>

        {/* Agent Status Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {agents.map((agent) => (
              <Grid item xs={12} md={6} lg={4} key={agent.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    {/* Agent Header */}
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2 }}>
                          {getAgentIcon(agent.provider)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{agent.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {agent.provider.toUpperCase()}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={agent.status}
                        color={getStatusColor(agent.status) as any}
                        size="small"
                      />
                    </Box>

                    {/* Current Task */}
                    {agent.currentTask && (
                      <Box mb={2}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Current Task
                        </Typography>
                        <Typography variant="body2">
                          {agent.currentTask}
                        </Typography>
                      </Box>
                    )}

                    {/* Metrics */}
                    <Box mb={2}>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Requests Today
                          </Typography>
                          <Typography variant="h6">{agent.requestsToday}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Success Rate
                          </Typography>
                          <Typography variant="h6">{agent.successRate}%</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Avg Response
                          </Typography>
                          <Typography variant="body2">{agent.avgResponseTime}s</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Uptime
                          </Typography>
                          <Typography variant="body2">{agent.uptime}</Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Resource Usage */}
                    <Box mb={1}>
                      <Typography variant="caption" color="text.secondary">
                        Memory Usage: {agent.memoryUsage}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={agent.memoryUsage} 
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        CPU Usage: {agent.cpuUsage}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={agent.cpuUsage} 
                      />
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={agent.status === 'active'}
                          onChange={(e) => handleAgentToggle(
                            agent.id, 
                            e.target.checked ? 'active' : 'stopped'
                          )}
                        />
                      }
                      label={agent.status === 'active' ? 'Active' : 'Stopped'}
                    />
                    <IconButton
                      onClick={() => openConfigDialog(agent)}
                      color="primary"
                    >
                      <TuneIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Task Queue Tab */}
        <TabPanel value={tabValue} index={1}>
          <List>
            {tasks.map((task) => (
              <React.Fragment key={task.id}>
                <ListItem>
                  <ListItemIcon>
                    {getTaskStatusIcon(task.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={task.description}
                    secondary={
                      <Box>
                        <Typography variant="caption" component="span">
                          {task.type} • Agent: {agents.find(a => a.id === task.agentId)?.name}
                        </Typography>
                        {task.duration && (
                          <Typography variant="caption" component="span" sx={{ ml: 2 }}>
                            Duration: {task.duration}s
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box textAlign="right">
                      <Typography variant="body2">
                        ${task.cost.toFixed(4)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {task.tokens} tokens
                      </Typography>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Total Requests Today
                </Typography>
                <Typography variant="h4" color="primary">
                  {agents.reduce((sum, agent) => sum + agent.requestsToday, 0)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Average Response Time
                </Typography>
                <Typography variant="h4" color="success.main">
                  {(agents.reduce((sum, agent) => sum + agent.avgResponseTime, 0) / agents.length).toFixed(2)}s
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Overall Success Rate
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {(agents.reduce((sum, agent) => sum + agent.successRate, 0) / agents.length).toFixed(1)}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={3}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Global agent configuration settings. Changes will affect all agents of the respective type.
          </Alert>
          <Grid container spacing={3}>
            {agents.map((agent) => (
              <Grid item xs={12} md={6} key={agent.id}>
                <Paper sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center">
                      {getAgentIcon(agent.provider)}
                      <Typography variant="h6" sx={{ ml: 1 }}>
                        {agent.name}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={() => openConfigDialog(agent)}
                    >
                      Configure
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Model: {agent.configuration.model}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Temperature: {agent.configuration.temperature}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Max Tokens: {agent.configuration.maxTokens}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
      </Paper>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Agent Configuration
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Model"
                value={tempConfig.model}
                onChange={(e) => setTempConfig(prev => ({ ...prev, model: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>Temperature: {tempConfig.temperature}</Typography>
              <Slider
                value={tempConfig.temperature}
                onChange={(_, value) => setTempConfig(prev => ({ ...prev, temperature: value as number }))}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0 (Focused)' },
                  { value: 1, label: '1 (Balanced)' },
                  { value: 2, label: '2 (Creative)' },
                ]}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Max Tokens"
                type="number"
                value={tempConfig.maxTokens}
                onChange={(e) => setTempConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Timeout (seconds)"
                type="number"
                value={tempConfig.timeout}
                onChange={(e) => setTempConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfigSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentMonitoring;