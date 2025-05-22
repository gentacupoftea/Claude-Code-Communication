import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import mcpService from '../../services/mcpService';

interface MCPSettingsState {
  apiKey: string;
  webhookUrl: string;
  proxyEnabled: boolean;
  debug: boolean;
  loading: boolean;
  saved: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'checking';
  lastChecked: Date | null;
}

const MCPSettingsComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [state, setState] = useState<MCPSettingsState>({
    apiKey: '',
    webhookUrl: '',
    proxyEnabled: true,
    debug: false,
    loading: true,
    saved: false,
    error: null,
    connectionStatus: 'checking',
    lastChecked: null,
  });

  // 設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await mcpService.getSettings();
        const connection = await mcpService.checkConnection();
        
        setState(prev => ({
          ...prev,
          apiKey: settings.apiKey || '',
          webhookUrl: settings.webhookUrl || '',
          proxyEnabled: settings.proxyEnabled,
          debug: settings.debug,
          loading: false,
          connectionStatus: connection.status,
          lastChecked: connection.lastChecked || null,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: '設定の読み込み中にエラーが発生しました。',
          connectionStatus: 'error',
        }));
      }
    };
    
    loadSettings();
  }, []);

  // 設定を保存
  const handleSave = async () => {
    setState(prev => ({ ...prev, loading: true, saved: false, error: null }));
    
    try {
      const settings = await mcpService.updateSettings({
        apiKey: state.apiKey,
        webhookUrl: state.webhookUrl,
        proxyEnabled: state.proxyEnabled,
        debug: state.debug,
      });
      
      setState(prev => ({
        ...prev,
        loading: false,
        saved: true,
        apiKey: settings.apiKey || '',
        webhookUrl: settings.webhookUrl || '',
        proxyEnabled: settings.proxyEnabled,
        debug: settings.debug,
      }));
      
      // 保存成功メッセージを3秒後に消す
      setTimeout(() => {
        setState(prev => ({ ...prev, saved: false }));
      }, 3000);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: '設定の保存中にエラーが発生しました。',
      }));
    }
  };

  // 接続の更新
  const handleRefreshConnection = async () => {
    setState(prev => ({ ...prev, connectionStatus: 'checking', error: null }));
    
    try {
      const connection = await mcpService.refreshConnection();
      
      setState(prev => ({
        ...prev,
        connectionStatus: connection.status,
        lastChecked: connection.lastChecked || new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: '接続の更新中にエラーが発生しました。',
      }));
    }
  };

  // クリップボードにコピー
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 接続状態のアイコンとカラー
  const getConnectionStatusInfo = () => {
    switch (state.connectionStatus) {
      case 'connected':
        return {
          icon: <CheckCircleIcon color="success" />,
          color: 'success' as const,
          text: 'オンライン',
        };
      case 'disconnected':
        return {
          icon: <InfoIcon color="warning" />,
          color: 'warning' as const,
          text: '未接続',
        };
      case 'error':
        return {
          icon: <ErrorIcon color="error" />,
          color: 'error' as const,
          text: 'エラー',
        };
      case 'checking':
      default:
        return {
          icon: <CircularProgress size={20} />,
          color: 'default' as const,
          text: '確認中',
        };
    }
  };

  const connectionStatusInfo = getConnectionStatusInfo();

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        MCPサーバー設定
      </Typography>
      <Typography color="text.secondary" paragraph>
        Shopify MCP（マルチチャネル連携）サーバーの接続設定を管理します。
      </Typography>

      {/* 接続ステータスカード */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">接続ステータス</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                icon={connectionStatusInfo.icon}
                label={connectionStatusInfo.text}
                color={connectionStatusInfo.color}
                size="small"
                sx={{ mr: 1 }}
              />
              <Tooltip title="接続を更新">
                <IconButton 
                  onClick={handleRefreshConnection}
                  disabled={state.connectionStatus === 'checking'}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            MCPサーバーURL: {process.env.REACT_APP_MCP_API_URL || 'https://staging-conea-ai.web.app/api'}
          </Typography>
          
          {state.lastChecked && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              最終確認: {state.lastChecked.toLocaleString()}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* メインの設定フォーム */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            API設定
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TextField
                  label="APIキー"
                  type="password"
                  fullWidth
                  value={state.apiKey}
                  onChange={(e) => setState(prev => ({ ...prev, apiKey: e.target.value }))}
                  disabled={state.loading}
                  sx={{ mr: 1 }}
                />
                <Tooltip title="コピー">
                  <IconButton 
                    onClick={() => handleCopy(state.apiKey)}
                    size="small"
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TextField
                  label="Webhook URL"
                  fullWidth
                  value={state.webhookUrl}
                  onChange={(e) => setState(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  disabled={state.loading}
                  helperText="MCPからの通知を受信するWebhook URL"
                  sx={{ mr: 1 }}
                />
                <Tooltip title="コピー">
                  <IconButton 
                    onClick={() => handleCopy(state.webhookUrl)}
                    size="small"
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            詳細設定
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={state.proxyEnabled}
                    onChange={(e) => setState(prev => ({ ...prev, proxyEnabled: e.target.checked }))}
                    disabled={state.loading}
                  />
                }
                label="APIプロキシを有効化"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                リクエスト制限を回避するためのプロキシ機能
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={state.debug}
                    onChange={(e) => setState(prev => ({ ...prev, debug: e.target.checked }))}
                    disabled={state.loading}
                  />
                }
                label="デバッグモード"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                詳細なログ出力とトレース情報を有効化
              </Typography>
            </Grid>
          </Grid>
          
          {state.error && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {state.error}
            </Alert>
          )}
          
          {state.saved && (
            <Alert severity="success" sx={{ mt: 3 }}>
              設定が保存されました。
            </Alert>
          )}
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={state.loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={state.loading}
            >
              保存
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* ヘルプセクション */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 3 }}>
        <Typography variant="body2">
          MCPの設定に関する詳細は、
          <Button size="small" sx={{ mx: 1 }}>
            ヘルプドキュメント
          </Button>
          をご参照ください。
        </Typography>
      </Alert>
    </Box>
  );
};

export default MCPSettingsComponent;