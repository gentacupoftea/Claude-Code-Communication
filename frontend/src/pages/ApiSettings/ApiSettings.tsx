import React, { useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';

interface PlatformConfig {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    storeUrl?: string;
    accessToken?: string;
  };
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

  const [platforms, setPlatforms] = useState<PlatformConfig[]>([
    {
      id: 'shopify',
      name: 'Shopify',
      status: 'connected',
      lastSync: new Date('2024-01-20'),
      credentials: {
        storeUrl: 'mystore.myshopify.com',
        apiKey: '••••••••••••••••',
        apiSecret: '••••••••••••••••',
      },
    },
    {
      id: 'rakuten',
      name: '楽天',
      status: 'disconnected',
    },
    {
      id: 'amazon',
      name: 'Amazon',
      status: 'error',
      lastSync: new Date('2024-01-15'),
    },
    {
      id: 'gsc',
      name: 'Google Search Console',
      status: 'connected',
      lastSync: new Date('2024-01-19'),
    },
  ]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setActiveStep(0);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    // API接続テストのシミュレーション
    setTimeout(() => {
      setTestingConnection(false);
    }, 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon style={{ width: 20, height: 20, color: theme.palette.success.main }} />;
      case 'error':
        return <ExclamationCircleIcon style={{ width: 20, height: 20, color: theme.palette.error.main }} />;
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
      default:
        return 'default';
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
                  helperText="「.myshopify.com」を含む完全なURLを入力"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="APIキー"
                  type="password"
                  placeholder="32文字の英数字"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="APIシークレット"
                  type="password"
                  placeholder="64文字の英数字"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="アクセストークン"
                  type="password"
                  placeholder="shpat_で始まるトークン"
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
            ) : (
              <Alert severity="success" sx={{ mb: 2 }}>
                接続に成功しました！
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
            <Chip
              label="最終同期: 2時間前"
              size="small"
              sx={{ ml: 'auto' }}
            />
          </Box>
          <List>
            <ListItem disablePadding>
              <ListItemText
                primary="ストアURL"
                secondary="mystore.myshopify.com"
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemText
                primary="APIキー"
                secondary="••••••••••••••••"
              />
              <ListItemSecondaryAction>
                <IconButton size="small">
                  <ArrowPathIcon style={{ width: 16, height: 16 }} />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small">
              再認証
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<TrashIcon style={{ width: 16, height: 16 }} />}
            >
              接続を削除
            </Button>
          </Box>
        </CardContent>
      </Card>
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
                  label={platform.status === 'connected' ? '接続済み' : platform.status === 'error' ? 'エラー' : '未接続'}
                  size="small"
                  color={getStatusColor(platform.status)}
                />
                {platform.lastSync && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    最終同期: {platform.lastSync.toLocaleDateString()}
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
    </Container>
  );
};

export const ApiSettings = mainLayout(ApiSettingsComponent);