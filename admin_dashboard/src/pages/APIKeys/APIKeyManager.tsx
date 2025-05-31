/**
 * API Key Manager - Comprehensive API Key Management
 * Claude, OpenAI, Gemini API キー管理システム
 */

import React, { useState, useEffect } from 'react';
import apiService, { APIKey as APIKeyType, User as ServiceUser } from '../../services/apiService';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
  TextField,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Divider,
  Tooltip,
  Badge,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Key,
  Security,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Person,
  Group,
  AttachMoney,
  Speed,
  Timeline,
  Shield,
  History,
  Edit,
  Delete,
  Add,
  ExpandMore,
  Notifications,
  TrendingUp,
  AccessTime,
  CloudSync,
  Lock,
  LockOpen,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Types
interface APIKey {
  id: string;
  provider: 'claude' | 'openai' | 'gemini';
  name: string;
  key: string;
  status: 'active' | 'inactive' | 'error' | 'testing';
  lastUsed: Date | null;
  usage: {
    daily: number;
    monthly: number;
    totalRequests: number;
    cost: number;
  };
  limits: {
    dailyLimit: number;
    monthlyLimit: number;
    costLimit: number;
  };
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
  lastAccess: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Sample data
const initialAPIKeys: APIKey[] = [
  {
    id: '1',
    provider: 'claude',
    name: 'Production Claude Key',
    key: 'sk-ant-api03-...',
    status: 'active',
    lastUsed: new Date(),
    usage: { daily: 1250, monthly: 28500, totalRequests: 142000, cost: 285.50 },
    limits: { dailyLimit: 5000, monthlyLimit: 50000, costLimit: 500 },
    permissions: ['read', 'write', 'admin'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
  },
  {
    id: '2',
    provider: 'openai',
    name: 'GPT-4 Integration',
    key: 'sk-proj-...',
    status: 'active',
    lastUsed: new Date(Date.now() - 3600000),
    usage: { daily: 850, monthly: 18200, totalRequests: 89000, cost: 182.00 },
    limits: { dailyLimit: 3000, monthlyLimit: 30000, costLimit: 300 },
    permissions: ['read', 'write'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date(),
  },
  {
    id: '3',
    provider: 'gemini',
    name: 'Gemini Pro API',
    key: 'AIzaSy...',
    status: 'inactive',
    lastUsed: new Date(Date.now() - 86400000),
    usage: { daily: 0, monthly: 12500, totalRequests: 45000, cost: 62.50 },
    limits: { dailyLimit: 2000, monthlyLimit: 25000, costLimit: 200 },
    permissions: ['read'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date(),
  },
];

const initialUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@conea.com',
    role: 'admin',
    permissions: ['all'],
    lastAccess: new Date(),
  },
  {
    id: '2',
    name: 'Developer',
    email: 'dev@conea.com',
    role: 'user',
    permissions: ['claude:read', 'claude:write', 'openai:read'],
    lastAccess: new Date(Date.now() - 1800000),
  },
  {
    id: '3',
    name: 'Analyst',
    email: 'analyst@conea.com',
    role: 'viewer',
    permissions: ['claude:read', 'openai:read', 'gemini:read'],
    lastAccess: new Date(Date.now() - 7200000),
  },
];

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const APIKeyManager: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [apiKeys, setApiKeys] = useState<APIKey[]>(initialAPIKeys);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Provider configuration
  const providerConfig = {
    claude: {
      name: 'Claude (Anthropic)',
      color: '#2563eb',
      icon: '🤖',
      baseUrl: 'https://api.anthropic.com',
    },
    openai: {
      name: 'OpenAI',
      color: '#10b981',
      icon: '🧠',
      baseUrl: 'https://api.openai.com',
    },
    gemini: {
      name: 'Gemini (Google)',
      color: '#f59e0b',
      icon: '💎',
      baseUrl: 'https://generativelanguage.googleapis.com',
    },
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const testConnection = async (apiKey: APIKey) => {
    setTestingKey(apiKey.id);
    setApiKeys(prev => prev.map(key => 
      key.id === apiKey.id ? { ...key, status: 'testing' } : key
    ));

    // Simulate API test
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate random success/failure for demo
      const success = Math.random() > 0.2;
      
      setApiKeys(prev => prev.map(key => 
        key.id === apiKey.id 
          ? { ...key, status: success ? 'active' : 'error', lastUsed: success ? new Date() : key.lastUsed }
          : key
      ));

      setSnackbar({
        open: true,
        message: success 
          ? `${providerConfig[apiKey.provider].name} connection test successful`
          : `${providerConfig[apiKey.provider].name} connection test failed`,
        severity: success ? 'success' : 'error',
      });
    } catch (error) {
      setApiKeys(prev => prev.map(key => 
        key.id === apiKey.id ? { ...key, status: 'error' } : key
      ));
      setSnackbar({
        open: true,
        message: 'Connection test failed',
        severity: 'error',
      });
    } finally {
      setTestingKey(null);
    }
  };

  const getStatusColor = (status: APIKey['status']) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'error': return 'error';
      case 'testing': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: APIKey['status']) => {
    switch (status) {
      case 'active': return <CheckCircle />;
      case 'inactive': return <Warning />;
      case 'error': return <Error />;
      case 'testing': return <Refresh className="animate-spin" />;
      default: return <Warning />;
    }
  };

  const formatUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatRelativeTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // API Key Cards Component
  const APIKeyCard: React.FC<{ apiKey: APIKey }> = ({ apiKey }) => {
    const config = providerConfig[apiKey.provider];
    const dailyPercentage = formatUsagePercentage(apiKey.usage.daily, apiKey.limits.dailyLimit);
    const monthlyPercentage = formatUsagePercentage(apiKey.usage.monthly, apiKey.limits.monthlyLimit);
    const costPercentage = formatUsagePercentage(apiKey.usage.cost, apiKey.limits.costLimit);

    return (
      <Card
        sx={{
          height: '100%',
          position: 'relative',
          border: `2px solid ${apiKey.status === 'active' ? config.color : '#e5e7eb'}`,
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
        }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: config.color }}>
              {config.icon}
            </Avatar>
          }
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{apiKey.name}</Typography>
              <Chip
                size="small"
                label={apiKey.status}
                color={getStatusColor(apiKey.status)}
                icon={getStatusIcon(apiKey.status)}
              />
            </Box>
          }
          subheader={config.name}
          action={
            <IconButton
              onClick={() => {
                setSelectedKey(apiKey);
                setEditDialogOpen(true);
              }}
            >
              <Settings />
            </IconButton>
          }
        />

        <CardContent>
          {/* API Key Input */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="API Key"
              type={showKeys[apiKey.id] ? 'text' : 'password'}
              value={apiKey.key}
              variant="outlined"
              size="small"
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                    edge="end"
                  >
                    {showKeys[apiKey.id] ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                ),
              }}
            />
          </Box>

          {/* Usage Statistics */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Usage Statistics
            </Typography>
            
            {/* Daily Usage */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Daily</Typography>
                <Typography variant="body2">
                  {apiKey.usage.daily.toLocaleString()} / {apiKey.limits.dailyLimit.toLocaleString()}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={dailyPercentage}
                color={getUsageColor(dailyPercentage)}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            {/* Monthly Usage */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Monthly</Typography>
                <Typography variant="body2">
                  {apiKey.usage.monthly.toLocaleString()} / {apiKey.limits.monthlyLimit.toLocaleString()}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={monthlyPercentage}
                color={getUsageColor(monthlyPercentage)}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            {/* Cost Usage */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Cost</Typography>
                <Typography variant="body2">
                  {formatCurrency(apiKey.usage.cost)} / {formatCurrency(apiKey.limits.costLimit)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={costPercentage}
                color={getUsageColor(costPercentage)}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          </Box>

          {/* Metadata */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Last used: {formatRelativeTime(apiKey.lastUsed)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Total requests: {apiKey.usage.totalRequests.toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            variant="outlined"
            onClick={() => testConnection(apiKey)}
            disabled={testingKey === apiKey.id}
            startIcon={testingKey === apiKey.id ? <Refresh className="animate-spin" /> : <CloudSync />}
          >
            Test Connection
          </Button>
          <Button
            size="small"
            onClick={() => {
              setSelectedKey(apiKey);
              setPermissionsDialogOpen(true);
            }}
            startIcon={<Security />}
          >
            Permissions
          </Button>
        </CardActions>
      </Card>
    );
  };

  // Permissions Matrix Component
  const PermissionsMatrix: React.FC = () => {
    const permissions = ['read', 'write', 'admin', 'billing'];
    
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              {apiKeys.map(key => (
                <TableCell key={key.id} align="center">
                  {providerConfig[key.provider].icon} {key.name}
                </TableCell>
              ))}
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {user.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={user.role}
                    color={user.role === 'admin' ? 'primary' : user.role === 'user' ? 'secondary' : 'default'}
                  />
                </TableCell>
                {apiKeys.map(key => (
                  <TableCell key={key.id} align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      {permissions.map(permission => {
                        const hasPermission = user.permissions.includes('all') || 
                          user.permissions.includes(`${key.provider}:${permission}`);
                        return (
                          <Tooltip key={permission} title={permission}>
                            <IconButton size="small" color={hasPermission ? 'primary' : 'default'}>
                              {permission === 'read' && <Visibility fontSize="small" />}
                              {permission === 'write' && <Edit fontSize="small" />}
                              {permission === 'admin' && <Security fontSize="small" />}
                              {permission === 'billing' && <AttachMoney fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </TableCell>
                ))}
                <TableCell align="center">
                  <IconButton size="small">
                    <Edit />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Usage Analytics Component
  const UsageAnalytics: React.FC = () => {
    return (
      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <TrendingUp />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {apiKeys.reduce((sum, key) => sum + key.usage.totalRequests, 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Requests
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <AttachMoney />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {formatCurrency(apiKeys.reduce((sum, key) => sum + key.usage.cost, 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Cost
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Speed />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {apiKeys.filter(key => key.status === 'active').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Keys
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <Warning />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {apiKeys.filter(key => 
                      formatUsagePercentage(key.usage.monthly, key.limits.monthlyLimit) > 80
                    ).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Near Limits
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage by Provider */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Usage by Provider" />
            <CardContent>
              <Grid container spacing={2}>
                {Object.entries(providerConfig).map(([provider, config]) => {
                  const keys = apiKeys.filter(key => key.provider === provider);
                  const totalUsage = keys.reduce((sum, key) => sum + key.usage.monthly, 0);
                  const totalCost = keys.reduce((sum, key) => sum + key.usage.cost, 0);
                  
                  return (
                    <Grid item xs={12} md={4} key={provider}>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography variant="h6">{config.icon}</Typography>
                          <Typography variant="h6">{config.name}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Monthly Requests: {totalUsage.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Monthly Cost: {formatCurrency(totalCost)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Keys: {keys.filter(key => key.status === 'active').length}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Security Settings Component
  const SecuritySettings: React.FC = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Security Settings"
              avatar={<Shield color="primary" />}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Require 2FA for API key access"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable API key rotation"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Allow API key sharing"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Log all API key usage"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Alert on unusual activity"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Access Logs"
              avatar={<History color="primary" />}
            />
            <CardContent>
              <List>
                {[
                  { action: 'API Key Created', user: 'admin@conea.com', time: '2 minutes ago' },
                  { action: 'Connection Test', user: 'dev@conea.com', time: '15 minutes ago' },
                  { action: 'Permission Updated', user: 'admin@conea.com', time: '1 hour ago' },
                  { action: 'Key Regenerated', user: 'admin@conea.com', time: '3 hours ago' },
                ].map((log, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <Security fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={log.action}
                      secondary={`${log.user} • ${log.time}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          API Key Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage Claude, OpenAI, and Gemini API keys with comprehensive security and usage controls
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="API Keys" icon={<Key />} />
          <Tab label="Permissions" icon={<Security />} />
          <Tab label="Usage Analytics" icon={<Timeline />} />
          <Tab label="Security" icon={<Shield />} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {apiKeys.map(apiKey => (
            <Grid item xs={12} md={6} lg={4} key={apiKey.id}>
              <APIKeyCard apiKey={apiKey} />
            </Grid>
          ))}
          
          {/* Add New Key Card */}
          <Grid item xs={12} md={6} lg={4}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #e5e7eb',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                },
              }}
              onClick={() => setEditDialogOpen(true)}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <Add sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Add New API Key
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <PermissionsMatrix />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <UsageAnalytics />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <SecuritySettings />
      </TabPanel>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default APIKeyManager;