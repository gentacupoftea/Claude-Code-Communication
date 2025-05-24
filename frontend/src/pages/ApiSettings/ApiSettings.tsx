import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  useTheme,
  alpha,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  InputAdornment,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
  KeyIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  TrashIcon,
  QuestionMarkCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import axios from 'axios';

interface PlatformConfig {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastSync?: Date;
  lastError?: string;
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    storeUrl?: string;
    accessToken?: string;
    webhookUrl?: string;
  };
  permissions?: string[];
  rateLimits?: {
    requestsPerMinute: number;
    currentUsage: number;
  };
}

interface ApiCredentials {
  storeUrl: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
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
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const ApiSettingsComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [testingConnection, setTestingConnection] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [credentials, setCredentials] = useState<ApiCredentials>({
    storeUrl: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
  });
  const [credentialErrors, setCredentialErrors] = useState<Partial<ApiCredentials>>({});

  const [platforms, setPlatforms] = useState<PlatformConfig[]>([
    {
      id: 'shopify',
      name: 'Shopify',
      status: 'disconnected',
      permissions: ['read_products', 'write_products', 'read_orders', 'write_orders'],
    },
    {
      id: 'rakuten',
      name: '楽天',
      status: 'disconnected',
    },
    {
      id: 'amazon',
      name: 'Amazon',
      status: 'disconnected',
    },
    {
      id: 'gsc',
      name: 'Google Search Console',
      status: 'disconnected',
    },
  ]);

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      // In production, this would load from API
      const savedPlatforms = localStorage.getItem('apiPlatforms');
      if (savedPlatforms) {
        setPlatforms(JSON.parse(savedPlatforms));
      }
    } catch (error) {
      console.error('Failed to load saved credentials:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setActiveStep(0);
    setCredentials({
      storeUrl: '',
      apiKey: '',
      apiSecret: '',
      accessToken: '',
    });
    setCredentialErrors({});
  };

  const validateCredentials = (): boolean => {
    const errors: Partial<ApiCredentials> = {};
    
    if (!credentials.storeUrl) {
      errors.storeUrl = 'ストアURLは必須です';
    } else if (!credentials.storeUrl.endsWith('.myshopify.com')) {
      errors.storeUrl = '正しいShopifyストアURLを入力してください';
    }
    
    if (!credentials.apiKey) {
      errors.apiKey = 'APIキーは必須です';
    } else if (credentials.apiKey.length !== 32) {
      errors.apiKey = 'APIキーは32文字である必要があります';
    }
    
    if (!credentials.apiSecret) {
      errors.apiSecret = 'APIシークレットは必須です';
    }
    
    if (!credentials.accessToken) {
      errors.accessToken = 'アクセストークンは必須です';
    } else if (!credentials.accessToken.startsWith('shpat_')) {
      errors.accessToken = '正しいアクセストークンを入力してください';
    }
    
    setCredentialErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateCredentials()) {
      setSnackbar({ open: true, message: '入力内容を確認してください', severity: 'error' });
      return;
    }
    
    setTestingConnection(true);
    const platformId = platforms[activeTab].id;
    
    try {
      // Simulate API connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would be:
      // const response = await axios.post('/api/platforms/test', {
      //   platform: platformId,
      //   credentials
      // });
      
      // Update platform status
      setPlatforms(prev => prev.map(p => 
        p.id === platformId 
          ? { 
              ...p, 
              status: 'connected',
              lastSync: new Date(),
              credentials: {
                ...credentials,
                apiKey: '•'.repeat(16),
                apiSecret: '•'.repeat(16),
                accessToken: '•'.repeat(16),
              }
            }
          : p
      ));
      
      // Save to localStorage (in production, this would be saved to backend)
      const updatedPlatforms = platforms.map(p => 
        p.id === platformId 
          ? { 
              ...p, 
              status: 'connected' as const,
              lastSync: new Date(),
              credentials: {
                ...credentials,
                apiKey: '•'.repeat(16),
                apiSecret: '•'.repeat(16),
                accessToken: '•'.repeat(16),
              }
            }
          : p
      );
      localStorage.setItem('apiPlatforms', JSON.stringify(updatedPlatforms));
      
      setSnackbar({ open: true, message: '接続に成功しました！', severity: 'success' });
      setActiveStep(3);
    } catch (error) {
      setPlatforms(prev => prev.map(p => 
        p.id === platformId 
          ? { ...p, status: 'error', lastError: 'Connection failed' }
          : p
      ));
      setSnackbar({ open: true, message: '接続に失敗しました', severity: 'error' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDeleteConnection = async (platformId: string) => {
    setPlatformToDelete(platformId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteConnection = async () => {
    if (!platformToDelete) return;
    
    try {
      // In production, this would be an API call
      // await axios.delete(`/api/platforms/${platformToDelete}`);
      
      setPlatforms(prev => prev.map(p => 
        p.id === platformToDelete 
          ? { 
              ...p, 
              status: 'disconnected' as const,
              credentials: undefined,
              lastSync: undefined,
              lastError: undefined,
            }
          : p
      ));
      
      // Update localStorage
      const updatedPlatforms = platforms.map(p => 
        p.id === platformToDelete 
          ? { 
              ...p, 
              status: 'disconnected' as const,
              credentials: undefined,
              lastSync: undefined,
              lastError: undefined,
            }
          : p
      );
      localStorage.setItem('apiPlatforms', JSON.stringify(updatedPlatforms));
      
      setSnackbar({ open: true, message: '接続を削除しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '削除に失敗しました', severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setPlatformToDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon style={{ width: 20, height: 20, color: theme.palette.success.main }} />;
      case 'error':
        return <ExclamationCircleIcon style={{ width: 20, height: 20, color: theme.palette.error.main }} />;
      case 'connecting':
        return <CircularProgress size={20} />;
      default:
        return <LinkIcon style={{ width: 20, height: 20, color: theme.palette.text.secondary }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'error':
        return 'error';
      case 'connecting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return '接続済み';
      case 'error':
        return 'エラー';
      case 'connecting':
        return '接続中';
      default:
        return '未接続';
    }
  };

  const renderShopifySetup = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Shopify API設定
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Shopifyアプリの作成</StepLabel>
          <StepContent>
            <Typography sx={{ mb: 2 }}>
              Shopifyパートナーダッシュボードで新しいアプリを作成します。
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              1. Shopifyパートナーアカウントにログイン<br />
              2. 「アプリ」→「アプリを作成」をクリック<br />
              3. プライベートアプリとして作成
            </Alert>
            <Button
              variant="contained"
              onClick={() => setActiveStep(1)}
              sx={{ mt: 1, mr: 1 }}
            >
              次へ
            </Button>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>API認証情報の取得</StepLabel>
          <StepContent>
            <Typography sx={{ mb: 2 }}>
              作成したアプリからAPI認証情報を取得します。
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ストアURL"
                  placeholder="mystore.myshopify.com"
                  value={credentials.storeUrl}
                  onChange={(e) => setCredentials(prev => ({ ...prev, storeUrl: e.target.value }))}
                  error={!!credentialErrors.storeUrl}
                  helperText={credentialErrors.storeUrl || "「.myshopify.com」を含む完全なURLを入力"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon style={{ width: 20, height: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="APIキー"
                  type={showApiKeys.apiKey ? "text" : "password"}
                  placeholder="32文字の英数字"
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                  error={!!credentialErrors.apiKey}
                  helperText={credentialErrors.apiKey || "ShopifyアプリのAPIキー"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyIcon style={{ width: 20, height: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKeys(prev => ({ ...prev, apiKey: !prev.apiKey }))}
                          edge="end"
                        >
                          {showApiKeys.apiKey ? 
                            <EyeSlashIcon style={{ width: 20, height: 20 }} /> : 
                            <EyeIcon style={{ width: 20, height: 20 }} />
                          }
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="APIシークレット"
                  type={showApiKeys.apiSecret ? "text" : "password"}
                  placeholder="64文字の英数字"
                  value={credentials.apiSecret}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                  error={!!credentialErrors.apiSecret}
                  helperText={credentialErrors.apiSecret || "ShopifyアプリのAPIシークレット"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShieldCheckIcon style={{ width: 20, height: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKeys(prev => ({ ...prev, apiSecret: !prev.apiSecret }))}
                          edge="end"
                        >
                          {showApiKeys.apiSecret ? 
                            <EyeSlashIcon style={{ width: 20, height: 20 }} /> : 
                            <EyeIcon style={{ width: 20, height: 20 }} />
                          }
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="アクセストークン"
                  type={showApiKeys.accessToken ? "text" : "password"}
                  placeholder="shpat_で始まるトークン"
                  value={credentials.accessToken}
                  onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                  error={!!credentialErrors.accessToken}
                  helperText={credentialErrors.accessToken || "Admin APIアクセストークン"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyIcon style={{ width: 20, height: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKeys(prev => ({ ...prev, accessToken: !prev.accessToken }))}
                          edge="end"
                        >
                          {showApiKeys.accessToken ? 
                            <EyeSlashIcon style={{ width: 20, height: 20 }} /> : 
                            <EyeIcon style={{ width: 20, height: 20 }} />
                          }
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                sx={{ mr: 1 }}
              >
                次へ
              </Button>
              <Button onClick={() => setActiveStep(0)}>
                戻る
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>接続テスト</StepLabel>
          <StepContent>
            <Typography sx={{ mb: 2 }}>
              入力した認証情報で接続をテストします。
            </Typography>
            {testingConnection ? (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography sx={{ mt: 1 }}>接続をテスト中...</Typography>
              </Box>
            ) : activeStep === 3 ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                接続に成功しました！
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                入力した認証情報で接続をテストします
              </Alert>
            )}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleTestConnection}
                sx={{ mr: 1 }}
              >
                接続テスト
              </Button>
              <Button onClick={() => setActiveStep(1)}>
                戻る
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      <Divider sx={{ my: 4 }} />

      {platforms[activeTab].status === 'connected' && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            現在の接続状態
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getStatusIcon('connected')}
                <Typography sx={{ ml: 1 }}>
                  接続済み
                </Typography>
                {platforms[activeTab].lastSync && (
                  <Chip
                    label={`最終同期: ${new Date(platforms[activeTab].lastSync).toLocaleString()}`}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
              <List>
                <ListItem disablePadding>
                  <ListItemText
                    primary="ストアURL"
                    secondary={platforms[activeTab].credentials?.storeUrl || '未設定'}
                  />
                  {platforms[activeTab].credentials?.storeUrl && (
                    <ListItemSecondaryAction>
                      <IconButton 
                        size="small"
                        onClick={() => copyToClipboard(platforms[activeTab].credentials?.storeUrl || '')}
                      >
                        <ClipboardDocumentIcon style={{ width: 16, height: 16 }} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary="APIキー"
                    secondary={platforms[activeTab].credentials?.apiKey || '未設定'}
                  />
                </ListItem>
                {platforms[activeTab].permissions && (
                  <ListItem disablePadding>
                    <ListItemText
                      primary="権限"
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          {platforms[activeTab].permissions.map(perm => (
                            <Chip 
                              key={perm} 
                              label={perm} 
                              size="small" 
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                        </Box>
                      }
                    />
                  </ListItem>
                )}
              </List>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => setActiveStep(1)}
                >
                  再認証
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<TrashIcon style={{ width: 16, height: 16 }} />}
                  onClick={() => handleDeleteConnection(platforms[activeTab].id)}
                >
                  接続を削除
                </Button>
              </Box>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );

  const renderPlatformTab = (platform: PlatformConfig) => {
    if (platform.id === 'shopify') {
      return renderShopifySetup();
    }

    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {platform.name} API設定
        </Typography>
        <Alert severity="info">
          {platform.name}の設定画面は準備中です。
        </Alert>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('apiSettings.title')}
        </Typography>
        <Typography color="text.secondary">
          {t('apiSettings.description')}
        </Typography>
      </Box>

      {/* 接続状態サマリー */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {platforms.map((platform) => (
          <Grid item xs={12} sm={6} md={3} key={platform.id}>
            <Card
              variant="outlined"
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                },
              }}
              onClick={() => {
                const index = platforms.findIndex(p => p.id === platform.id);
                setActiveTab(index);
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {getStatusIcon(platform.status)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {platform.name}
                  </Typography>
                </Box>
                <Chip
                  label={getStatusLabel(platform.status)}
                  size="small"
                  color={getStatusColor(platform.status)}
                />
                {platform.lastSync && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    最終同期: {new Date(platform.lastSync).toLocaleDateString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* プラットフォーム別設定タブ */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="API設定タブ"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {platforms.map((platform, index) => (
            <Tab
              key={platform.id}
              label={platform.name}
              icon={getStatusIcon(platform.status)}
              iconPosition="start"
            />
          ))}
        </Tabs>
        {platforms.map((platform, index) => (
          <TabPanel key={platform.id} value={activeTab} index={index}>
            {renderPlatformTab(platform)}
          </TabPanel>
        ))}
      </Paper>

      {/* ヘルプセクション */}
      <Box sx={{ mt: 4 }}>
        <Alert severity="info" icon={<QuestionMarkCircleIcon style={{ width: 20, height: 20 }} />}>
          <Typography variant="body2">
            API設定についてお困りの場合は、
            <Button size="small" sx={{ ml: 1 }}>
              ヘルプドキュメント
            </Button>
            をご確認いただくか、サポートまでお問い合わせください。
          </Typography>
        </Alert>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          接続を削除しますか？
        </DialogTitle>
        <DialogContent>
          <Typography>
            {platformToDelete && platforms.find(p => p.id === platformToDelete)?.name}の接続を削除します。
            この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={confirmDeleteConnection} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export const ApiSettings = mainLayout(ApiSettingsComponent);