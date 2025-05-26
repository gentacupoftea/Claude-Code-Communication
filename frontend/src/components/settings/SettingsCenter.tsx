import React, { useState } from 'react';
import { shopifyService } from '../../services/shopifyService';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  useTheme,
  alpha,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  Storage as StorageIcon,
  Shield as ShieldIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  Visibility,
  VisibilityOff,
  CloudSync,
  Business,
  Key,
  Link,
  DataUsage,
  Timeline,
  VpnKey,
  Email,
  Sms,
} from '@mui/icons-material';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactElement;
}

interface APIConnection {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  platform: string;
  endpoint: string;
}

const SettingsCenter: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    // General Settings
    companyName: 'Conea Corporation',
    timezone: 'Asia/Tokyo',
    language: 'ja',
    currency: 'JPY',
    
    // Appearance Settings
    theme: 'auto',
    sidebarCollapsed: false,
    densityMode: 'comfortable',
    
    // Notification Settings
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    
    // Security Settings
    twoFactorAuth: false,
    sessionTimeout: 30,
    ipRestriction: false,
    
    // API Settings
    shopifyStoreUrl: '',
    shopifyApiKey: 'sk_test_*********************',
    shopifyApiSecret: '*********************',
    shopifyAccessToken: '',
    shopifyStoreId: '',
    rakutenApiKey: '*********************',
    amazonApiKey: '*********************',
    webhookUrl: 'https://staging-conea-ai.web.app/api/webhook',
    apiRateLimit: 1000,
    
    // Advanced Settings
    debugMode: false,
    analyticsEnabled: true,
    cacheEnabled: true,
    compressionEnabled: true,
  });

  const [apiConnections] = useState<APIConnection[]>([
    {
      id: '1',
      name: 'Shopify Store',
      status: 'connected',
      lastSync: new Date(),
      platform: 'shopify',
      endpoint: 'https://your-store.myshopify.com',
    },
    {
      id: '2',
      name: '楽天市場',
      status: 'connected',
      lastSync: new Date(Date.now() - 300000), // 5 minutes ago
      platform: 'rakuten',
      endpoint: 'https://api.rms.rakuten.co.jp',
    },
    {
      id: '3',
      name: 'Amazon Seller',
      status: 'error',
      lastSync: new Date(Date.now() - 3600000), // 1 hour ago
      platform: 'amazon',
      endpoint: 'https://sellingpartnerapi-na.amazon.com',
    },
  ]);

  const tabs: SettingsTab[] = [
    { id: 'general', label: '一般', icon: <PersonIcon /> },
    { id: 'api', label: 'API設定', icon: <ApiIcon /> },
    { id: 'security', label: 'セキュリティ', icon: <SecurityIcon /> },
    { id: 'notifications', label: '通知', icon: <NotificationsIcon /> },
    { id: 'appearance', label: '外観', icon: <PaletteIcon /> },
    { id: 'advanced', label: '詳細', icon: <CodeIcon /> },
  ];

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const handleTestConnection = async (connectionId: string) => {
    setTestingConnection(true);
    // Simulate API test
    setTimeout(() => {
      setTestingConnection(false);
    }, 2000);
  };

  const handleTestShopifyConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await shopifyService.testConnection({
        store_url: settings.shopifyStoreUrl || '',
        store_id: settings.shopifyStoreId,
        api_key: settings.shopifyApiKey || '',
        api_secret: settings.shopifyApiSecret || '',
        access_token: settings.shopifyAccessToken || ''
      });
      
      if (result.success) {
        alert('Shopify接続テスト成功！');
      } else {
        alert(`接続テスト失敗: ${result.message}`);
      }
    } catch (error) {
      alert(`接続テストエラー: ${error}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveShopifySettings = async () => {
    setSaveStatus('saving');
    try {
      const result = await shopifyService.connectStore({
        store_url: settings.shopifyStoreUrl || '',
        store_id: settings.shopifyStoreId,
        api_key: settings.shopifyApiKey || '',
        api_secret: settings.shopifyApiSecret || '',
        access_token: settings.shopifyAccessToken || ''
      });
      
      if (result.success) {
        setSaveStatus('saved');
        alert(`Shopify設定保存成功！Store ID: ${result.store_id}`);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
        alert(`設定保存失敗: ${result.message}`);
      }
    } catch (error) {
      setSaveStatus('idle');
      alert(`設定保存エラー: ${error}`);
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'connected': return 'success';
      case 'error': return 'error';
      case 'disconnected': return 'warning';
      default: return 'info';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'disconnected': return <WarningIcon color="warning" />;
      default: return <InfoIcon />;
    }
  };

  const renderGeneralSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🏢 一般設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="会社名"
            value={settings.companyName}
            onChange={(e) => setSettings({...settings, companyName: e.target.value})}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>タイムゾーン</InputLabel>
            <Select
              value={settings.timezone}
              label="タイムゾーン"
              onChange={(e) => setSettings({...settings, timezone: e.target.value})}
            >
              <MenuItem value="Asia/Tokyo">Asia/Tokyo (JST)</MenuItem>
              <MenuItem value="America/New_York">America/New_York (EST)</MenuItem>
              <MenuItem value="Europe/London">Europe/London (GMT)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>言語</InputLabel>
            <Select
              value={settings.language}
              label="言語"
              onChange={(e) => setSettings({...settings, language: e.target.value})}
            >
              <MenuItem value="ja">日本語</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="ko">한국어</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>通貨</InputLabel>
            <Select
              value={settings.currency}
              label="通貨"
              onChange={(e) => setSettings({...settings, currency: e.target.value})}
            >
              <MenuItem value="JPY">日本円 (¥)</MenuItem>
              <MenuItem value="USD">米ドル ($)</MenuItem>
              <MenuItem value="EUR">ユーロ (€)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderApiSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔗 API設定
      </Typography>
      
      {/* API接続状況 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            プラットフォーム接続状況
          </Typography>
          <Grid container spacing={2}>
            {apiConnections.map((connection) => (
              <Grid item xs={12} md={4} key={connection.id}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar 
                      sx={{ 
                        mx: 'auto', 
                        mb: 1,
                        bgcolor: alpha(theme.palette[getStatusColor(connection.status)].main, 0.1),
                        color: theme.palette[getStatusColor(connection.status)].main,
                      }}
                    >
                      {getStatusIcon(connection.status)}
                    </Avatar>
                    <Typography variant="body2" fontWeight="medium">
                      {connection.name}
                    </Typography>
                    <Chip 
                      label={connection.status} 
                      color={getStatusColor(connection.status)}
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      最終同期: {connection.lastSync.toLocaleTimeString()}
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => handleTestConnection(connection.id)}
                      disabled={testingConnection}
                      sx={{ mt: 1 }}
                    >
                      接続テスト
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            API キー設定
          </Typography>
        </Grid>
        
        {/* Shopify設定セクション */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            🛍️ Shopify設定
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="ストアURL"
            value={settings.shopifyStoreUrl || ''}
            onChange={(e) => setSettings({...settings, shopifyStoreUrl: e.target.value})}
            placeholder="mystore.myshopify.com"
            helperText=".myshopify.comを含む完全なURL"
            sx={{ mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="ストアID"
            value={settings.shopifyStoreId || ''}
            onChange={(e) => setSettings({...settings, shopifyStoreId: e.target.value})}
            placeholder="store-123"
            helperText="Shopifyストアの一意識別子"
            sx={{ mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={settings.shopifyApiKey}
            onChange={(e) => setSettings({...settings, shopifyApiKey: e.target.value})}
            InputProps={{
              endAdornment: (
                <Box>
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                  >
                    {showApiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                  <IconButton
                    onClick={() => navigator.clipboard.writeText(settings.shopifyApiKey)}
                    edge="end"
                  >
                    <CopyIcon />
                  </IconButton>
                </Box>
              ),
            }}
            sx={{ mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="API シークレット"
            type="password"
            value={settings.shopifyApiSecret || ''}
            onChange={(e) => setSettings({...settings, shopifyApiSecret: e.target.value})}
            sx={{ mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="アクセストークン"
            type="password"
            value={settings.shopifyAccessToken || ''}
            onChange={(e) => setSettings({...settings, shopifyAccessToken: e.target.value})}
            placeholder="shpat_で始まるトークン"
            helperText="OAuth認証後に取得されるアクセストークン"
            sx={{ mb: 2 }}
          />
        </Grid>
        
        {/* Shopify接続ボタン */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              onClick={handleTestShopifyConnection}
              disabled={testingConnection || !settings.shopifyStoreUrl || !settings.shopifyApiKey || !settings.shopifyAccessToken}
              startIcon={testingConnection ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircleIcon />}
            >
              {testingConnection ? '接続テスト中...' : 'Shopify接続テスト'}
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveShopifySettings}
              disabled={!settings.shopifyStoreUrl || !settings.shopifyApiKey || !settings.shopifyAccessToken}
              startIcon={<SaveIcon />}
            >
              Shopify設定を保存
            </Button>
          </Box>
        </Grid>
        
        {/* 他のプラットフォーム設定 */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            🌐 その他のプラットフォーム
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="楽天 API Key"
            type="password"
            value={settings.rakutenApiKey}
            onChange={(e) => setSettings({...settings, rakutenApiKey: e.target.value})}
            sx={{ mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Amazon API Key"
            type="password"
            value={settings.amazonApiKey}
            onChange={(e) => setSettings({...settings, amazonApiKey: e.target.value})}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Webhook URL"
            value={settings.webhookUrl}
            onChange={(e) => setSettings({...settings, webhookUrl: e.target.value})}
            helperText="イベント通知を受信するURL"
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            label="API Rate Limit (requests/hour)"
            type="number"
            value={settings.apiRateLimit}
            onChange={(e) => setSettings({...settings, apiRateLimit: parseInt(e.target.value)})}
            sx={{ width: 200 }}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderSecuritySettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🛡️ セキュリティ設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.twoFactorAuth}
                onChange={(e) => setSettings({...settings, twoFactorAuth: e.target.checked})}
              />
            }
            label="二段階認証"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
            ログイン時に追加の認証を要求します
          </Typography>
          
          <TextField
            label="セッションタイムアウト (分)"
            type="number"
            value={settings.sessionTimeout}
            onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
            sx={{ width: 200, mb: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.ipRestriction}
                onChange={(e) => setSettings({...settings, ipRestriction: e.target.checked})}
              />
            }
            label="IP制限"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            特定のIPアドレスからのみアクセスを許可
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const renderNotificationSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔔 通知設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              />
            }
            label="メール通知"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
            重要な更新をメールで通知
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.pushNotifications}
                onChange={(e) => setSettings({...settings, pushNotifications: e.target.checked})}
              />
            }
            label="プッシュ通知"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            ブラウザ通知を有効化
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.marketingEmails}
                onChange={(e) => setSettings({...settings, marketingEmails: e.target.checked})}
              />
            }
            label="マーケティングメール"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            プロモーションや新機能の案内
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAppearanceSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🎨 外観設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>テーマ</InputLabel>
            <Select
              value={settings.theme}
              label="テーマ"
              onChange={(e) => setSettings({...settings, theme: e.target.value})}
            >
              <MenuItem value="light">ライト</MenuItem>
              <MenuItem value="dark">ダーク</MenuItem>
              <MenuItem value="auto">システム設定に従う</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth>
            <InputLabel>表示密度</InputLabel>
            <Select
              value={settings.densityMode}
              label="表示密度"
              onChange={(e) => setSettings({...settings, densityMode: e.target.value})}
            >
              <MenuItem value="comfortable">快適</MenuItem>
              <MenuItem value="compact">コンパクト</MenuItem>
              <MenuItem value="spacious">ゆったり</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.sidebarCollapsed}
                onChange={(e) => setSettings({...settings, sidebarCollapsed: e.target.checked})}
              />
            }
            label="サイドバーを折りたたむ"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            より多くの作業スペースを確保
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAdvancedSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        ⚙️ 詳細設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.debugMode}
                onChange={(e) => setSettings({...settings, debugMode: e.target.checked})}
              />
            }
            label="デバッグモード"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
            詳細なログとエラー情報を表示
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.analyticsEnabled}
                onChange={(e) => setSettings({...settings, analyticsEnabled: e.target.checked})}
              />
            }
            label="分析データ収集"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            利用状況の分析とサービス改善のため
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.cacheEnabled}
                onChange={(e) => setSettings({...settings, cacheEnabled: e.target.checked})}
              />
            }
            label="キャッシュ機能"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
            データの読み込み速度を向上
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.compressionEnabled}
                onChange={(e) => setSettings({...settings, compressionEnabled: e.target.checked})}
              />
            }
            label="データ圧縮"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            通信量を削減
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: return renderGeneralSettings();
      case 1: return renderApiSettings();
      case 2: return renderSecuritySettings();
      case 3: return renderNotificationSettings();
      case 4: return renderAppearanceSettings();
      case 5: return renderAdvancedSettings();
      default: return renderGeneralSettings();
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          ⚙️ 設定センター
        </Typography>
        <Typography variant="body1" color="text.secondary">
          システム全体の設定とAPI連携を管理
        </Typography>
      </Box>

      {/* タブナビゲーション */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* コンテンツエリア */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {renderTabContent()}
      </Paper>

      {/* アクションボタン */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          {saveStatus === 'saved' && (
            <Alert severity="success" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              設定が正常に保存されました
            </Alert>
          )}
        </Box>
        
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />}>
            リセット
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? '保存中...' : '設定を保存'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SettingsCenter;