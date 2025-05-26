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
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
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
  console.log('AgentMonitoring component loaded');
  
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

  const loadAgentData = async () => {
    console.log('Loading agent data...');
    try {
      // 実際のAI設定を取得
      const response = await fetch('http://localhost:8000/api/ai/config');
      const aiConfig = await response.json();
      
      const activeAgents: AgentStatus[] = [];
      
      // Claude Agent
      if (aiConfig.claude?.enabled) {
        activeAgents.push({
          id: 'claude-1',
          name: 'Claude Analysis Agent',
          provider: 'claude',
          status: 'active',
          currentTask: 'Ready for tasks',
          uptime: '0h 0m',
          requestsToday: 0,
          avgResponseTime: 0,
          successRate: 100,
          errorCount: 0,
          lastActivity: 'Just configured',
          memoryUsage: 15,
          cpuUsage: 5,
          configuration: {
            model: aiConfig.claude.model,
            temperature: aiConfig.settings.temperature,
            maxTokens: aiConfig.settings.maxTokens,
            timeout: aiConfig.settings.requestTimeout / 1000,
          },
        });
      }
      
      // OpenAI Agent
      if (aiConfig.openai?.enabled) {
        activeAgents.push({
          id: 'openai-1',
          name: 'OpenAI Assistant',
          provider: 'openai',
          status: 'idle',
          currentTask: 'Standby',
          uptime: '0h 0m',
          requestsToday: 0,
          avgResponseTime: 0,
          successRate: 100,
          errorCount: 0,
          lastActivity: 'Ready',
          memoryUsage: 12,
          cpuUsage: 3,
          configuration: {
            model: aiConfig.openai.model,
            temperature: aiConfig.settings.temperature,
            maxTokens: aiConfig.settings.maxTokens,
            timeout: aiConfig.settings.requestTimeout / 1000,
          },
        });
      }
      
      // Gemini Agent
      if (aiConfig.gemini?.enabled) {
        activeAgents.push({
          id: 'gemini-1',
          name: 'Gemini Research Agent',
          provider: 'gemini',
          status: 'idle',
          currentTask: 'Standby',
          uptime: '0h 0m',
          requestsToday: 0,
          avgResponseTime: 0,
          successRate: 100,
          errorCount: 0,
          lastActivity: 'Ready',
          memoryUsage: 10,
          cpuUsage: 2,
          configuration: {
            model: aiConfig.gemini.model,
            temperature: aiConfig.settings.temperature,
            maxTokens: aiConfig.settings.maxTokens,
            timeout: aiConfig.settings.requestTimeout / 1000,
          },
        });
      }
      
      setAgents(activeAgents);
    } catch (error) {
      console.error('Failed to load agent data:', error);
      // フォールバック：設定されていない場合は空配列
      setAgents([]);
    }
  };

  const loadTaskData = async () => {
    try {
      // 実際のタスクデータを取得（実装予定）
      // const response = await fetch('http://localhost:8000/api/tasks');
      // const tasksData = await response.json();
      
      // 現在は空の配列を設定（実際のタスクが実行されると更新される）
      setTasks([]);
    } catch (error) {
      console.error('Failed to load task data:', error);
      setTasks([]);
    }
  };

  const updateRealTimeData = async () => {
    try {
      // 実際のエージェント統計を取得
      const response = await fetch('http://localhost:8000/api/ai/stats');
      if (response.ok) {
        const stats = await response.json();
        // 実際の統計データでエージェント情報を更新
        setAgents(prev => prev.map(agent => ({
          ...agent,
          requestsToday: stats[agent.provider]?.requestsToday || agent.requestsToday,
          avgResponseTime: stats[agent.provider]?.avgResponseTime || agent.avgResponseTime,
          successRate: stats[agent.provider]?.successRate || agent.successRate,
          errorCount: stats[agent.provider]?.errorCount || agent.errorCount,
          lastActivity: stats[agent.provider]?.lastActivity || agent.lastActivity,
        })));
      }
    } catch (error) {
      console.log('Stats API not available yet, keeping current values');
      // APIが未実装の場合は値を変更しない
    }
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
    console.log('📝 openConfigDialog called with agent:', agent.name);
    console.log('📝 Agent configuration:', agent.configuration);
    console.log('📝 Setting selectedAgent to:', agent.id);
    console.log('📝 Setting configDialogOpen to true');
    
    setSelectedAgent(agent.id);
    setTempConfig(agent.configuration);
    setConfigDialogOpen(true);
    
    console.log('📝 Dialog state updated');
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
    <>
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
          onChange={(_, newValue) => {
            console.log('Tab changed to:', newValue);
            setTabValue(newValue);
          }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab 
            icon={<ClaudeIcon />} 
            label="エージェント状態" 
            sx={{ minHeight: 72, fontSize: '0.875rem' }}
          />
          <Tab 
            icon={<ChartIcon />} 
            label="タスクキュー" 
            sx={{ minHeight: 72, fontSize: '0.875rem' }}
          />
          <Tab 
            icon={<SpeedIcon />} 
            label="パフォーマンス" 
            sx={{ minHeight: 72, fontSize: '0.875rem' }}
          />
          <Tab 
            icon={<SettingsIcon />} 
            label="設定" 
            sx={{ minHeight: 72, fontSize: '0.875rem' }}
          />
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

                  <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
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
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<TuneIcon />}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔧 Settings button clicked for agent:', agent.name);
                        console.log('🔧 Agent ID:', agent.id);
                        console.log('🔧 Opening config dialog...');
                        openConfigDialog(agent);
                      }}
                      sx={{ 
                        minWidth: 'auto',
                        zIndex: 10,
                        position: 'relative'
                      }}
                    >
                      Settings
                    </Button>
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
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => {
                        console.log('Config button clicked for agent:', agent.name);
                        openConfigDialog(agent);
                      }}
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
      {console.log('🔧 Rendering Dialog with open:', configDialogOpen)}
      <Dialog 
        open={configDialogOpen} 
        onClose={() => {
          console.log('🔧 Dialog close called');
          setConfigDialogOpen(false);
        }} 
        maxWidth="sm" 
        fullWidth
      >
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
    </>
  );
};

export default AgentMonitoring;