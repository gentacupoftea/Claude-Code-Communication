/**
 * Slack Integration Page - Slack統合設定ページ
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Chat as SlackIcon,
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Settings,
  Visibility,
  VisibilityOff,
  Link,
  LinkOff,
  Chat,
  Code,
  People,
  Notifications,
  Security,
  Add as AddIcon,
} from '@mui/icons-material';

import apiService, { SlackConfig } from '../../services/apiService';

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

const SlackIntegration: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [config, setConfig] = useState<SlackConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    botToken: '',
    appToken: '',
    signingSecret: '',
    workspace: '',
    features: {
      mentionCommands: true,
      slashCommands: true,
      directMessages: false,
    },
    channels: [] as string[],
  });
  
  const [showTokens, setShowTokens] = useState({
    botToken: false,
    appToken: false,
    signingSecret: false,
  });
  
  const [newChannel, setNewChannel] = useState('');
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  useEffect(() => {
    loadSlackConfig();
  }, []);

  const loadSlackConfig = async () => {
    try {
      setLoading(true);
      const slackConfig = await apiService.getSlackConfig();
      setConfig(slackConfig);
      
      if (slackConfig) {
        setFormData({
          botToken: slackConfig.botToken,
          appToken: slackConfig.appToken,
          signingSecret: slackConfig.signingSecret,
          workspace: slackConfig.workspace,
          features: slackConfig.features,
          channels: slackConfig.channels || [],
        });
      }
    } catch (error) {
      console.error('Failed to load Slack config:', error);
      showSnackbar('Slack設定の読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('🔧 Save button clicked');
    console.log('🔧 FormData:', formData);
    
    try {
      setSaving(true);
      console.log('🔧 Calling apiService.saveSlackConfig...');
      const savedConfig = await apiService.saveSlackConfig(formData);
      console.log('🔧 Save successful:', savedConfig);
      setConfig(savedConfig);
      showSnackbar('Slack設定を保存しました', 'success');
    } catch (error) {
      console.error('🔧 Failed to save Slack config:', error);
      showSnackbar('設定の保存に失敗しました', 'error');
    } finally {
      setSaving(false);
      console.log('🔧 Save process completed');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const result = await apiService.testSlackConnection();
      
      if (result.success) {
        showSnackbar(
          `接続テスト成功！ワークスペース: ${result.workspace || 'Unknown'}`,
          'success'
        );
      } else {
        showSnackbar(result.message, 'error');
      }
    } catch (error) {
      showSnackbar('接続テストに失敗しました', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const result = await apiService.connectSlack();
      
      if (result.success) {
        showSnackbar('Slack Botに接続しました', 'success');
        await loadSlackConfig(); // Reload to get updated status
      } else {
        showSnackbar('接続に失敗しました', 'error');
      }
    } catch (error) {
      showSnackbar('接続処理でエラーが発生しました', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setConnecting(true);
      const result = await apiService.disconnectSlack();
      
      if (result.success) {
        showSnackbar('Slack Botを切断しました', 'info');
        await loadSlackConfig();
      } else {
        showSnackbar('切断に失敗しました', 'error');
      }
    } catch (error) {
      showSnackbar('切断処理でエラーが発生しました', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFeatureChange = (feature: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled,
      },
    }));
  };

  const handleAddChannel = () => {
    if (newChannel.trim() && !formData.channels.includes(newChannel.trim())) {
      const channelName = newChannel.trim().startsWith('#') ? newChannel.trim() : `#${newChannel.trim()}`;
      setFormData(prev => ({
        ...prev,
        channels: [...prev.channels, channelName],
      }));
      setNewChannel('');
      setChannelDialogOpen(false);
    }
  };

  const handleRemoveChannel = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c !== channel),
    }));
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const getStatusIcon = () => {
    switch (config?.status) {
      case 'connected':
        return <CheckCircle color="success" />;
      case 'disconnected':
        return <LinkOff color="disabled" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getStatusColor = () => {
    switch (config?.status) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'warning';
    }
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
      <Box display="flex" alignItems="center" mb={3}>
        <SlackIcon sx={{ fontSize: 32, mr: 2, color: '#4A154B' }} />
        <Box>
          <Typography variant="h4" component="h1">
            Slack Integration
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Connect Conea with your Slack workspace
          </Typography>
        </Box>
      </Box>

      {/* Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              {getStatusIcon()}
              <Box ml={2}>
                <Typography variant="h6">
                  Connection Status
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip 
                    label={config?.status || 'Not configured'} 
                    color={getStatusColor() as any}
                    size="small"
                  />
                  {config?.workspace && (
                    <Typography variant="body2" color="text.secondary">
                      Workspace: {config.workspace}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
            
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                onClick={handleTestConnection}
                disabled={testing || !formData.botToken}
                startIcon={testing ? <CircularProgress size={16} /> : <Refresh />}
              >
                Test Connection
              </Button>
              
              {config?.status === 'connected' ? (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDisconnect}
                  disabled={connecting}
                  startIcon={connecting ? <CircularProgress size={16} /> : <LinkOff />}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleConnect}
                  disabled={connecting || !formData.botToken}
                  startIcon={connecting ? <CircularProgress size={16} /> : <Link />}
                >
                  Connect
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<Settings />} label="Basic Settings" />
          <Tab icon={<Security />} label="Authentication" />
          <Tab icon={<Chat />} label="Features" />
          <Tab icon={<People />} label="Channels" />
        </Tabs>

        {/* Basic Settings Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Workspace Name"
                value={formData.workspace}
                onChange={(e) => handleInputChange('workspace', e.target.value)}
                placeholder="your-workspace"
                helperText="The name of your Slack workspace"
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  To set up Slack integration, you'll need to create a Slack app and configure the necessary permissions.
                  Visit the <strong>Authentication</strong> tab to enter your tokens.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Authentication Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>📱 Slack App設定手順（2024年最新版）</Typography>
                <Typography variant="body2" paragraph>
                  <strong>1. Slack Appの作成</strong><br />
                  • <a href="https://api.slack.com/apps" target="_blank" rel="noopener">api.slack.com/apps</a> にアクセス<br />
                  • 「Create New App」→「From scratch」<br />
                  • App名とワークスペースを選択
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>2. OAuth & Permissions（必須）</strong><br />
                  • 左メニュー「OAuth & Permissions」<br />
                  • 「Scopes」→「Bot Token Scopes」で権限を追加<br />
                  • 「Install to Workspace」でワークスペースにインストール
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>3. Socket Mode（推奨）</strong><br />
                  • 左メニュー「Socket Mode」<br />
                  • 「Enable Socket Mode」をON<br />
                  • 新しいトークンを生成（connections:writeスコープ）
                </Typography>
                <Typography variant="body2">
                  <strong>4. Event Subscriptions</strong><br />
                  • 左メニュー「Event Subscriptions」<br />
                  • 「Enable Events」をON<br />
                  • 「Subscribe to bot events」で app_mentions を追加
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                トークンは暗号化して保存されます。外部に漏らさないよう注意してください。
              </Alert>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  📍 Bot User OAuth Token の取得方法
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>手順:</strong><br />
                  1. 左メニュー「OAuth & Permissions」<br />
                  2. 「Bot Token Scopes」で必要な権限を追加<br />
                  3. 「Install to Workspace」ボタンをクリック<br />
                  4. 権限を承認後、「Bot User OAuth Token」が表示される
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ⚠️ ワークスペースにインストール後に生成されます
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bot User OAuth Token"
                type={showTokens.botToken ? 'text' : 'password'}
                value={formData.botToken}
                onChange={(e) => handleInputChange('botToken', e.target.value)}
                placeholder="xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx"
                helperText="OAuth & Permissions → Bot User OAuth Token (xoxb-で始まる)"
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowTokens(prev => ({ ...prev, botToken: !prev.botToken }))}
                      edge="end"
                    >
                      {showTokens.botToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  📍 App-Level Token の取得方法
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>手順:</strong><br />
                  1. 左メニュー「Socket Mode」<br />
                  2. 「Enable Socket Mode」トグルをON<br />
                  3. 「Generate an app-level token」をクリック<br />
                  4. Token名を入力、「connections:write」スコープを選択<br />
                  5. 「Generate」ボタンでトークン生成
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  💡 Socket Modeでリアルタイム通信が可能になります
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="App-Level Token"
                type={showTokens.appToken ? 'text' : 'password'}
                value={formData.appToken}
                onChange={(e) => handleInputChange('appToken', e.target.value)}
                placeholder="xapp-1-A1234567890-1234567890123-abcdefghijklmnopqrstuvwxyz"
                helperText="Socket Mode → App-Level Tokens → Generate Token (xapp-で始まる)"
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowTokens(prev => ({ ...prev, appToken: !prev.appToken }))}
                      edge="end"
                    >
                      {showTokens.appToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  📍 Signing Secret の取得方法
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>手順:</strong><br />
                  1. 左メニュー「Basic Information」<br />
                  2. 「App Credentials」セクションを探す<br />
                  3. 「Signing Secret」の「Show」ボタンをクリック<br />
                  4. 表示された32文字のハッシュ値をコピー
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  🔒 リクエスト署名の検証に使用（セキュリティ必須）
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Signing Secret"
                type={showTokens.signingSecret ? 'text' : 'password'}
                value={formData.signingSecret}
                onChange={(e) => handleInputChange('signingSecret', e.target.value)}
                placeholder="abcdef1234567890abcdef1234567890abcdef12"
                helperText="Basic Information → App Credentials → Signing Secret (32文字のハッシュ値)"
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowTokens(prev => ({ ...prev, signingSecret: !prev.signingSecret }))}
                      edge="end"
                    >
                      {showTokens.signingSecret ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="h6" gutterBottom>
                  🔒 必要な Bot Token Scopes
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  「OAuth & Permissions」→「Bot Token Scopes」で以下を追加：
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>• app_mentions:read</strong><br />
                      → @botのメンション検知
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>• chat:write</strong><br />
                      → メッセージ送信権限
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>• channels:read</strong><br />
                      → チャンネル情報取得
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>• users:read</strong><br />
                      → ユーザー情報取得
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <Typography variant="h6" gutterBottom>
                  ⚡ Event Subscriptions 設定
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Subscribe to bot events:</strong> app_mentions
                </Typography>
                <Typography variant="body2">
                  Socket Mode使用時はRequest URLの設定は不要です
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Features Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Enable Slack Features
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Chat sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Mention Commands</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Respond to @conea-dev, @conea-design, @conea-pm mentions
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.features.mentionCommands}
                        onChange={(e) => handleFeatureChange('mentionCommands', e.target.checked)}
                      />
                    }
                    label="Enable mention commands"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Code sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Slash Commands</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Use /conea command for quick actions
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.features.slashCommands}
                        onChange={(e) => handleFeatureChange('slashCommands', e.target.checked)}
                      />
                    }
                    label="Enable slash commands"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Notifications sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Direct Messages</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Allow direct messages to the bot
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.features.directMessages}
                        onChange={(e) => handleFeatureChange('directMessages', e.target.checked)}
                      />
                    }
                    label="Enable direct messages"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Command Examples:</strong><br/>
                  • <code>@conea-dev "Fix login bug in authentication module"</code><br/>
                  • <code>@conea-design "Create mobile UI for dashboard"</code><br/>
                  • <code>@conea-pm "Generate progress report for Q1"</code>
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Channels Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Monitored Channels</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setChannelDialogOpen(true)}
                >
                  Add Channel
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              {formData.channels.length > 0 ? (
                <List>
                  {formData.channels.map((channel, index) => (
                    <React.Fragment key={channel}>
                      <ListItem
                        secondaryAction={
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleRemoveChannel(channel)}
                          >
                            Remove
                          </Button>
                        }
                      >
                        <ListItemIcon>
                          <Chat />
                        </ListItemIcon>
                        <ListItemText
                          primary={channel}
                          secondary="Bot will respond to mentions in this channel"
                        />
                      </ListItem>
                      {index < formData.channels.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  No channels configured. Add channels where the bot should listen for commands.
                </Alert>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Save Button */}
      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
          size="large"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>

      {/* Add Channel Dialog */}
      <Dialog open={channelDialogOpen} onClose={() => setChannelDialogOpen(false)}>
        <DialogTitle>Add Channel</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Channel Name"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            placeholder="#general"
            helperText="Enter the channel name (with or without #)"
            sx={{ mt: 1 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddChannel();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChannelDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddChannel} variant="contained">
            Add
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

export default SlackIntegration;