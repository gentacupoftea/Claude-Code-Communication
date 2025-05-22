/**
 * Monitoring Page - AI Agent Activity Monitoring Dashboard
 * Comprehensive monitoring interface for AI agents with chat-based UI, real-time updates, and billing information
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Tooltip,
  Divider,
  Badge,
  CircularProgress,
  Switch,
  FormControlLabel,
  Alert,
  AlertTitle,
  CardHeader,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Smart_toy as ClaudeIcon,
  Psychology as OpenAIIcon,
  AutoAwesome as GeminiIcon,
  Circle,
  TrendingUp,
  TrendingDown,
  Refresh,
  Settings,
  Warning,
  CheckCircle,
  Error,
  Info,
  AccessTime,
  MonetizationOn,
  Speed,
  CloudDone,
  GitHub,
  Chat,
  Token,
  Analytics,
  WifiOff,
  Wifi,
  VolumeUp,
  VolumeOff,
} from '@mui/icons-material';
import { useDashboard } from '../../contexts/DashboardContext';

// Types and Interfaces
interface ChatMessage {
  id: string;
  agentType: 'claude' | 'openai' | 'gemini' | 'user';
  content: string;
  timestamp: Date;
  duration?: number;
  cost?: number;
  tokens?: number;
  status: 'sending' | 'success' | 'error' | 'timeout';
  conversationId?: string;
}

interface AgentStatus {
  id: string;
  name: string;
  type: 'claude' | 'openai' | 'gemini';
  status: 'active' | 'idle' | 'error' | 'offline';
  currentTask?: string;
  responseTime: number;
  successRate: number;
  errorCount: number;
  tokensUsed: number;
  cost: number;
  lastActivity: Date;
}

interface BillingInfo {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  tokenUsage: {
    claude: number;
    openai: number;
    gemini: number;
  };
  costBreakdown: {
    claude: number;
    openai: number;
    gemini: number;
  };
  budgetLimit: number;
  budgetUsed: number;
  alerts: BudgetAlert[];
}

interface BudgetAlert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  threshold: number;
  current: number;
}

interface SystemEvent {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  source: 'slack' | 'github' | 'system' | 'api';
  message: string;
  timestamp: Date;
  details?: string;
}

interface MetricsData {
  responseTime: Array<{ time: string; value: number }>;
  successRate: Array<{ time: string; value: number }>;
  tokenUsage: Array<{ time: string; claude: number; openai: number; gemini: number }>;
  costTrend: Array<{ time: string; value: number }>;
}

// Agent Configuration
const agentConfigs = {
  claude: {
    name: 'Claude',
    color: '#FF6B35',
    icon: ClaudeIcon,
    darkColor: '#E55A2B',
  },
  openai: {
    name: 'OpenAI GPT',
    color: '#10A37F',
    icon: OpenAIIcon,
    darkColor: '#0D8B6B',
  },
  gemini: {
    name: 'Google Gemini',
    color: '#4285F4',
    icon: GeminiIcon,
    darkColor: '#3367D6',
  },
};

const MonitoringPage: React.FC = () => {
  const { addNotification } = useDashboard();
  
  // State Management
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Connection Management
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:8080/monitoring');
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        if (autoRefresh) {
          setTimeout(connectWebSocket, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, [autoRefresh]);

  // Handle WebSocket Messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'agent_status_update':
        setAgents(prev => prev.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, ...data.status }
            : agent
        ));
        break;
        
      case 'new_chat_message':
        const newMessage: ChatMessage = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        };
        setChatMessages(prev => [...prev, newMessage]);
        
        if (soundEnabled && data.message.agentType !== 'user') {
          playNotificationSound();
        }
        break;
        
      case 'billing_update':
        setBillingInfo(data.billing);
        
        // Check for budget alerts
        if (data.billing.alerts.length > 0) {
          data.billing.alerts.forEach((alert: BudgetAlert) => {
            addNotification({
              title: 'Budget Alert',
              message: alert.message,
              type: alert.type === 'critical' ? 'error' : 'warning',
            });
          });
        }
        break;
        
      case 'system_event':
        const newEvent: SystemEvent = {
          ...data.event,
          timestamp: new Date(data.event.timestamp),
        };
        setSystemEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
        break;
        
      case 'metrics_update':
        setMetricsData(data.metrics);
        break;
    }
  }, [addNotification, soundEnabled]);

  // Initialize Mock Data and WebSocket
  useEffect(() => {
    initializeMockData();
    
    if (autoRefresh) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoRefresh, connectWebSocket]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Initialize Mock Data
  const initializeMockData = () => {
    const mockAgents: AgentStatus[] = [
      {
        id: 'claude-1',
        name: 'Claude-3-Sonnet',
        type: 'claude',
        status: 'active',
        currentTask: 'Processing code review for PR #142',
        responseTime: 1.2,
        successRate: 98.5,
        errorCount: 2,
        tokensUsed: 45230,
        cost: 18.92,
        lastActivity: new Date(Date.now() - 30000),
      },
      {
        id: 'openai-1',
        name: 'GPT-4-Turbo',
        type: 'openai',
        status: 'idle',
        responseTime: 0.8,
        successRate: 96.8,
        errorCount: 5,
        tokensUsed: 32100,
        cost: 12.45,
        lastActivity: new Date(Date.now() - 300000),
      },
      {
        id: 'gemini-1',
        name: 'Gemini-Pro',
        type: 'gemini',
        status: 'active',
        currentTask: 'Analyzing user feedback sentiment',
        responseTime: 1.5,
        successRate: 94.2,
        errorCount: 8,
        tokensUsed: 28900,
        cost: 9.67,
        lastActivity: new Date(Date.now() - 60000),
      },
    ];

    const mockBilling: BillingInfo = {
      totalCost: 567.89,
      dailyCost: 23.45,
      monthlyCost: 456.78,
      tokenUsage: {
        claude: 145230,
        openai: 123100,
        gemini: 98900,
      },
      costBreakdown: {
        claude: 234.56,
        openai: 189.23,
        gemini: 144.10,
      },
      budgetLimit: 1000,
      budgetUsed: 567.89,
      alerts: [
        {
          id: 'alert-1',
          type: 'warning',
          message: 'Monthly budget is 56% used',
          threshold: 50,
          current: 56.8,
        },
      ],
    };

    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        agentType: 'user',
        content: 'Please analyze the performance metrics for last week',
        timestamp: new Date(Date.now() - 300000),
        status: 'success',
        conversationId: 'conv-1',
      },
      {
        id: '2',
        agentType: 'claude',
        content: 'I\'ve analyzed the performance metrics for the past week. Here are the key findings:\n\n• API response time improved by 15%\n• Error rate decreased to 0.8%\n• User engagement increased by 23%\n\nWould you like me to provide more detailed insights?',
        timestamp: new Date(Date.now() - 280000),
        duration: 2.3,
        cost: 0.045,
        tokens: 89,
        status: 'success',
        conversationId: 'conv-1',
      },
      {
        id: '3',
        agentType: 'user',
        content: 'Generate a summary report for the stakeholders',
        timestamp: new Date(Date.now() - 120000),
        status: 'success',
        conversationId: 'conv-2',
      },
      {
        id: '4',
        agentType: 'openai',
        content: 'I\'m generating a comprehensive stakeholder report. This will include executive summary, key metrics, recommendations, and visual charts. Estimated completion time: 30 seconds.',
        timestamp: new Date(Date.now() - 100000),
        duration: 1.8,
        cost: 0.032,
        tokens: 67,
        status: 'success',
        conversationId: 'conv-2',
      },
    ];

    const mockEvents: SystemEvent[] = [
      {
        id: 'event-1',
        type: 'success',
        source: 'slack',
        message: 'Slack integration: Message sent to #ai-alerts channel',
        timestamp: new Date(Date.now() - 180000),
      },
      {
        id: 'event-2',
        type: 'info',
        source: 'github',
        message: 'GitHub automation: PR #142 reviewed and approved',
        timestamp: new Date(Date.now() - 240000),
      },
      {
        id: 'event-3',
        type: 'warning',
        source: 'system',
        message: 'High memory usage detected on agent claude-1',
        timestamp: new Date(Date.now() - 360000),
      },
    ];

    setAgents(mockAgents);
    setBillingInfo(mockBilling);
    setChatMessages(mockMessages);
    setSystemEvents(mockEvents);
  };

  // Utility Functions
  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMdBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McLnzJ8N2QQAoUXrTp66hVFApGn+DyvmMdBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAoTXrPq66hWFAlFnuDyvmQcBDGB0fPKdSEELIHO8tiJOQcZZ7zs5Z5NEAxPqOLvt2McCjiR1/LNeSsFJHfH8N2QQAo=');
    audio.play().catch(() => {
      // Ignore audio play errors
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(1)}s`;
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(3)}`;
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'idle': return 'warning';
      case 'error': return 'error';
      case 'offline': return 'default';
      default: return 'default';
    }
  };

  const getEventIcon = (source: string) => {
    switch (source) {
      case 'slack': return <Chat />;
      case 'github': return <GitHub />;
      case 'api': return <CloudDone />;
      default: return <Info />;
    }
  };

  const refreshData = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_refresh' }));
    } else {
      initializeMockData();
    }
  };

  // Render Agent Status Card
  const renderAgentCard = (agent: AgentStatus) => {
    const config = agentConfigs[agent.type];
    const IconComponent = config.icon;

    return (
      <Card key={agent.id} sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: config.color, mr: 2 }}>
              <IconComponent />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{config.name}</Typography>
              <Chip
                size="small"
                label={agent.status}
                color={getStatusColor(agent.status) as any}
                icon={<Circle sx={{ fontSize: 8 }} />}
              />
            </Box>
            <Badge color="error" badgeContent={agent.errorCount} showZero={false}>
              <IconButton size="small">
                <Settings />
              </IconButton>
            </Badge>
          </Box>

          {agent.currentTask && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {agent.currentTask}
            </Typography>
          )}

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Response Time
                </Typography>
                <Typography variant="h6">
                  {formatDuration(agent.responseTime)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Success Rate
                </Typography>
                <Typography variant="h6">{agent.successRate}%</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Tokens Used
                </Typography>
                <Typography variant="h6">
                  {agent.tokensUsed.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Cost
                </Typography>
                <Typography variant="h6">{formatCost(agent.cost)}</Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Last Activity: {formatTimestamp(agent.lastActivity)}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Render Chat Message
  const renderChatMessage = (message: ChatMessage) => {
    const isUser = message.agentType === 'user';
    const config = !isUser ? agentConfigs[message.agentType] : null;

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Box sx={{ maxWidth: '70%', display: 'flex', alignItems: 'flex-start' }}>
          {!isUser && (
            <Avatar
              sx={{
                bgcolor: config?.color,
                width: 32,
                height: 32,
                mr: 1,
                mt: 0.5,
              }}
            >
              {config && React.createElement(config.icon, { sx: { fontSize: 16 } })}
            </Avatar>
          )}
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isUser ? 'primary.main' : 'background.paper',
              color: isUser ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              position: 'relative',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {formatTimestamp(message.timestamp)}
              </Typography>
              
              {!isUser && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {message.duration && (
                    <Chip
                      size="small"
                      label={formatDuration(message.duration)}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                  {message.cost && (
                    <Chip
                      size="small"
                      label={formatCost(message.cost)}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                  {message.tokens && (
                    <Chip
                      size="small"
                      label={`${message.tokens} tokens`}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                </Box>
              )}
            </Box>
            
            {message.status === 'sending' && (
              <CircularProgress size={12} sx={{ position: 'absolute', top: 8, right: 8 }} />
            )}
          </Paper>
          
          {isUser && (
            <Avatar
              sx={{
                bgcolor: 'grey.400',
                width: 32,
                height: 32,
                ml: 1,
                mt: 0.5,
              }}
            >
              👤
            </Avatar>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          AI Agent Monitoring
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
            }
            label={<VolumeUp />}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          
          <Tooltip title="Connection Status">
            <Chip
              icon={isConnected ? <Wifi /> : <WifiOff />}
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              variant="outlined"
            />
          </Tooltip>
          
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={refreshData}
            disabled={!isConnected}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Budget Alerts */}
      {billingInfo?.alerts.map((alert) => (
        <Alert
          key={alert.id}
          severity={alert.type === 'critical' ? 'error' : 'warning'}
          sx={{ mb: 2 }}
        >
          <AlertTitle>Budget Alert</AlertTitle>
          {alert.message} ({alert.current}% of {alert.threshold}% threshold)
        </Alert>
      ))}

      <Grid container spacing={3}>
        {/* Agent Status Panel */}
        <Grid item xs={12} lg={8}>
          <Typography variant="h6" gutterBottom>
            Agent Status
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {agents.map(renderAgentCard)}
          </Grid>

          {/* Chat Interface */}
          <Card sx={{ height: 600 }}>
            <CardHeader
              title="Live Conversations"
              action={
                <Chip
                  icon={<Chat />}
                  label={`${chatMessages.length} messages`}
                  variant="outlined"
                />
              }
            />
            <CardContent>
              <Box
                sx={{
                  height: 480,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                {chatMessages.map(renderChatMessage)}
                <div ref={chatEndRef} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Billing Information */}
          {billingInfo && (
            <Card sx={{ mb: 3 }}>
              <CardHeader
                title="Billing Overview"
                avatar={<MonetizationOn />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Daily Cost
                    </Typography>
                    <Typography variant="h6">
                      {formatCost(billingInfo.dailyCost)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Monthly Cost
                    </Typography>
                    <Typography variant="h6">
                      {formatCost(billingInfo.monthlyCost)}
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Budget Usage</Typography>
                    <Typography variant="body2">
                      {((billingInfo.budgetUsed / billingInfo.budgetLimit) * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(billingInfo.budgetUsed / billingInfo.budgetLimit) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    ${billingInfo.budgetUsed} / ${billingInfo.budgetLimit}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Cost Breakdown
                </Typography>
                {Object.entries(billingInfo.costBreakdown).map(([provider, cost]) => (
                  <Box key={provider} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {provider}
                    </Typography>
                    <Typography variant="body2">{formatCost(cost)}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          <Card sx={{ mb: 3 }}>
            <CardHeader
              title="Performance Metrics"
              avatar={<Analytics />}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Avg Response Time</Typography>
                    <Typography variant="body2">1.2s</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={75} sx={{ mb: 2 }} />
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Success Rate</Typography>
                    <Typography variant="body2">96.5%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={96.5} color="success" sx={{ mb: 2 }} />
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Token Usage (24h)</Typography>
                    <Typography variant="body2">367k</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={60} color="warning" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader
              title="System Events"
              action={
                <Chip
                  icon={<Info />}
                  label={systemEvents.length}
                  size="small"
                  variant="outlined"
                />
              }
            />
            <CardContent sx={{ p: 0 }}>
              <List dense>
                {systemEvents.slice(0, 10).map((event) => (
                  <ListItem key={event.id}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {getEventIcon(event.source)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={event.message}
                      secondary={formatTimestamp(event.timestamp)}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        size="small"
                        label={event.type}
                        color={
                          event.type === 'error' ? 'error' :
                          event.type === 'warning' ? 'warning' :
                          event.type === 'success' ? 'success' : 'default'
                        }
                      />
                    </ListItemSecondaryAction>
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

export default MonitoringPage;