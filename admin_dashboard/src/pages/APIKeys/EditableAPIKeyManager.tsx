/**
 * Editable API Key Manager - Full CRUD operations
 * 完全編集可能なAPI Key管理システム
 */

import React, { useState, useEffect } from 'react';
import apiService, { APIKey, User as UserType } from '../../services/apiService';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  LinearProgress,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility,
  VisibilityOff,
  Science as TestIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Psychology as ClaudeIcon,
  SmartToy as OpenAIIcon,
  AutoAwesome as GeminiIcon,
  CheckCircle,
  Error,
  Warning,
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

interface APIKeyFormData {
  provider: 'claude' | 'openai' | 'gemini';
  name: string;
  key: string;
  status: 'active' | 'inactive';
}

const EditableAPIKeyManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<{ [key: string]: boolean }>({});
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Form states
  const [keyFormData, setKeyFormData] = useState<APIKeyFormData>({
    provider: 'claude',
    name: '',
    key: '',
    status: 'active',
  });
  
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
    permissions: {
      claude: false,
      openai: false,
      gemini: false,
      billing: false,
    },
  });
  
  const [testingKeys, setTestingKeys] = useState<{ [key: string]: boolean }>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysData, usersData] = await Promise.all([
        apiService.getAPIKeys(),
        apiService.getUsers(),
      ]);
      setApiKeys(keysData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showSnackbar('データの読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  // API Key Operations
  const handleCreateKey = async () => {
    try {
      const newKey = await apiService.createAPIKey(keyFormData);
      setApiKeys(prev => [...prev, newKey]);
      setCreateDialogOpen(false);
      resetKeyForm();
      showSnackbar('API Keyを作成しました', 'success');
    } catch (error) {
      console.error('Failed to create API key:', error);
      showSnackbar('API Keyの作成に失敗しました', 'error');
    }
  };

  const handleUpdateKey = async (id: string, data: Partial<APIKey>) => {
    try {
      const updatedKey = await apiService.updateAPIKey(id, data);
      setApiKeys(prev => prev.map(key => key.id === id ? updatedKey : key));
      setEditingId(null);
      showSnackbar('API Keyを更新しました', 'success');
    } catch (error) {
      console.error('Failed to update API key:', error);
      showSnackbar('API Keyの更新に失敗しました', 'error');
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedKeyId) return;
    
    try {
      await apiService.deleteAPIKey(selectedKeyId);
      setApiKeys(prev => prev.filter(key => key.id !== selectedKeyId));
      setDeleteDialogOpen(false);
      setSelectedKeyId(null);
      showSnackbar('API Keyを削除しました', 'success');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      showSnackbar('API Keyの削除に失敗しました', 'error');
    }
  };

  const handleTestKey = async (id: string) => {
    try {
      setTestingKeys(prev => ({ ...prev, [id]: true }));
      const result = await apiService.testAPIKey(id);
      
      if (result.success) {
        showSnackbar(
          `接続テスト成功${result.responseTime ? ` (${result.responseTime}ms)` : ''}`,
          'success'
        );
        // Update key status
        await handleUpdateKey(id, { status: 'active' });
      } else {
        showSnackbar(result.message, 'error');
        await handleUpdateKey(id, { status: 'error' });
      }
    } catch (error) {
      showSnackbar('接続テストに失敗しました', 'error');
    } finally {
      setTestingKeys(prev => ({ ...prev, [id]: false }));
    }
  };

  // User Operations
  const handleCreateUser = async () => {
    try {
      const newUser = await apiService.createUser(userFormData);
      setUsers(prev => [...prev, newUser]);
      setUserDialogOpen(false);
      resetUserForm();
      showSnackbar('ユーザーを作成しました', 'success');
    } catch (error) {
      console.error('Failed to create user:', error);
      showSnackbar('ユーザーの作成に失敗しました', 'error');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUserId) return;
    
    try {
      const updatedUser = await apiService.updateUser(editingUserId, userFormData);
      setUsers(prev => prev.map(user => user.id === editingUserId ? updatedUser : user));
      setUserDialogOpen(false);
      setEditingUserId(null);
      resetUserForm();
      showSnackbar('ユーザーを更新しました', 'success');
    } catch (error) {
      console.error('Failed to update user:', error);
      showSnackbar('ユーザーの更新に失敗しました', 'error');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await apiService.deleteUser(id);
      setUsers(prev => prev.filter(user => user.id !== id));
      showSnackbar('ユーザーを削除しました', 'success');
    } catch (error) {
      console.error('Failed to delete user:', error);
      showSnackbar('ユーザーの削除に失敗しました', 'error');
    }
  };

  // Helper functions
  const resetKeyForm = () => {
    setKeyFormData({
      provider: 'claude',
      name: '',
      key: '',
      status: 'active',
    });
  };

  const resetUserForm = () => {
    setUserFormData({
      name: '',
      email: '',
      role: 'user',
      permissions: {
        claude: false,
        openai: false,
        gemini: false,
        billing: false,
      },
    });
  };

  const openEditUser = (user: UserType) => {
    setEditingUserId(user.id);
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    });
    setUserDialogOpen(true);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'claude':
        return <ClaudeIcon sx={{ color: '#ff6b35' }} />;
      case 'openai':
        return <OpenAIIcon sx={{ color: '#00a67e' }} />;
      case 'gemini':
        return <GeminiIcon sx={{ color: '#4285f4' }} />;
      default:
        return <SecurityIcon />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '***' + key.substring(key.length - 4);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          🔑 API Key Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New API Key
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="API Keys" />
          <Tab label="Users & Permissions" />
          <Tab label="Usage Analytics" />
        </Tabs>

        {/* API Keys Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {apiKeys.map((apiKey) => (
              <Grid item xs={12} md={6} lg={4} key={apiKey.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        {getProviderIcon(apiKey.provider)}
                        <Box ml={1}>
                          <Typography variant="h6">{apiKey.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {apiKey.provider.toUpperCase()}
                          </Typography>
                        </Box>
                      </Box>
                      {getStatusIcon(apiKey.status)}
                    </Box>

                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        API Key
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
                          {showKey[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                        >
                          {showKey[apiKey.id] ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Box>
                    </Box>

                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        Usage: {apiKey.usageCount} requests
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cost: ${apiKey.monthlyCost.toFixed(2)} this month
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last used: {apiKey.lastUsed ? formatDate(apiKey.lastUsed) : 'Never'}
                      </Typography>
                    </Box>

                    <Chip
                      label={apiKey.status}
                      color={apiKey.status === 'active' ? 'success' : 'error'}
                      size="small"
                    />
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => handleTestKey(apiKey.id)}
                      disabled={testingKeys[apiKey.id]}
                      startIcon={testingKeys[apiKey.id] ? <CircularProgress size={16} /> : <TestIcon />}
                    >
                      Test
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => setEditingId(apiKey.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        setSelectedKeyId(apiKey.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">User Management</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetUserForm();
                setUserDialogOpen(true);
              }}
            >
              Add User
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        {user.permissions.claude && <Chip label="Claude" size="small" />}
                        {user.permissions.openai && <Chip label="OpenAI" size="small" />}
                        {user.permissions.gemini && <Chip label="Gemini" size="small" />}
                        {user.permissions.billing && <Chip label="Billing" size="small" />}
                      </Box>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openEditUser(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Total API Keys
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {apiKeys.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Active Keys
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {apiKeys.filter(key => key.status === 'active').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Monthly Cost
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    ${apiKeys.reduce((sum, key) => sum + key.monthlyCost, 0).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Key</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={keyFormData.provider}
                  onChange={(e) => setKeyFormData(prev => ({ ...prev, provider: e.target.value as any }))}
                >
                  <MenuItem value="claude">Claude (Anthropic)</MenuItem>
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="gemini">Gemini (Google)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={keyFormData.name}
                onChange={(e) => setKeyFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Claude Production"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={keyFormData.key}
                onChange={(e) => setKeyFormData(prev => ({ ...prev, key: e.target.value }))}
                placeholder="Enter your API key"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateKey}
            variant="contained"
            disabled={!keyFormData.name || !keyFormData.key}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this API key? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteKey} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUserId ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={userFormData.name}
                onChange={(e) => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value as any }))}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.permissions.claude}
                    onChange={(e) => setUserFormData(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, claude: e.target.checked }
                    }))}
                  />
                }
                label="Claude Access"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.permissions.openai}
                    onChange={(e) => setUserFormData(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, openai: e.target.checked }
                    }))}
                  />
                }
                label="OpenAI Access"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.permissions.gemini}
                    onChange={(e) => setUserFormData(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, gemini: e.target.checked }
                    }))}
                  />
                }
                label="Gemini Access"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.permissions.billing}
                    onChange={(e) => setUserFormData(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, billing: e.target.checked }
                    }))}
                  />
                }
                label="Billing Access"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={editingUserId ? handleUpdateUser : handleCreateUser}
            variant="contained"
            disabled={!userFormData.name || !userFormData.email}
          >
            {editingUserId ? 'Update' : 'Create'}
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

export default EditableAPIKeyManager;