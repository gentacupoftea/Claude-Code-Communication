import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Tabs,
  Tab,
  Stack,
  Chip,
  IconButton,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

interface ProjectSettingsProps {
  open: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  onSave: (settings: ProjectFolderSettings) => void;
}

interface ProjectFolderSettings {
  systemPrompt: string;
  promptVariables: { [key: string]: string };
  apiSettings: {
    shopify?: {
      enabled: boolean;
      apiKey: string;
      storeUrl: string;
      accessToken: string;
    };
    amazon?: {
      enabled: boolean;
      sellerId: string;
      authToken: string;
      marketplaceId: string;
    };
    rakuten?: {
      enabled: boolean;
      serviceSecret: string;
      licenseKey: string;
    };
    nextengine?: {
      enabled: boolean;
      uid: string;
      pwd: string;
    };
    custom?: {
      [name: string]: {
        enabled: boolean;
        url: string;
        headers: { [key: string]: string };
      };
    };
  };
}

const DEFAULT_SYSTEM_PROMPTS = [
  {
    name: 'EC売上分析',
    prompt: `あなたはECサイトの売上データ分析の専門家です。
以下の役割を持ちます：
- 売上データの傾向分析
- 商品パフォーマンスの評価
- 在庫最適化の提案
- 季節性やイベント影響の分析

変数：
- {{company_name}}: 会社名
- {{analysis_period}}: 分析期間
- {{target_metrics}}: 重点指標`,
  },
  {
    name: 'マーケティング分析',
    prompt: `あなたはマーケティングデータ分析の専門家です。
以下の機能を提供します：
- 広告効果の測定と最適化提案
- 顧客セグメント分析
- コンバージョン率改善のアドバイス
- ROI計算と予算配分提案

変数：
- {{brand_name}}: ブランド名
- {{campaign_type}}: キャンペーン種別
- {{target_audience}}: ターゲット層`,
  },
  {
    name: '在庫管理',
    prompt: `あなたは在庫管理の専門家です。
以下のタスクを実行します：
- 在庫レベルの最適化
- 需要予測に基づく発注提案
- デッドストック分析
- 季節変動への対応策

変数：
- {{warehouse_location}}: 倉庫場所
- {{lead_time}}: リードタイム
- {{safety_stock_level}}: 安全在庫レベル`,
  },
];

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  open,
  onClose,
  folderId,
  folderName,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<ProjectFolderSettings>({
    systemPrompt: '',
    promptVariables: {},
    apiSettings: {},
  });
  
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [newVariableKey, setNewVariableKey] = useState('');
  const [newVariableValue, setNewVariableValue] = useState('');

  useEffect(() => {
    // 既存設定の読み込み（実際の実装では API から取得）
    const existingSettings = localStorage.getItem(`project-settings-${folderId}`);
    if (existingSettings) {
      setSettings(JSON.parse(existingSettings));
    }
  }, [folderId]);

  const handleSave = () => {
    // 設定を保存
    localStorage.setItem(`project-settings-${folderId}`, JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const handlePromptTemplateSelect = (template: typeof DEFAULT_SYSTEM_PROMPTS[0]) => {
    setSettings(prev => ({
      ...prev,
      systemPrompt: template.prompt,
    }));
  };

  const handleAddVariable = () => {
    if (newVariableKey && newVariableValue) {
      setSettings(prev => ({
        ...prev,
        promptVariables: {
          ...prev.promptVariables,
          [newVariableKey]: newVariableValue,
        },
      }));
      setNewVariableKey('');
      setNewVariableValue('');
    }
  };

  const handleRemoveVariable = (key: string) => {
    setSettings(prev => {
      const { [key]: removed, ...rest } = prev.promptVariables;
      return {
        ...prev,
        promptVariables: rest,
      };
    });
  };

  const handleApiSettingChange = (
    provider: string,
    field: string,
    value: string | boolean
  ) => {
    setSettings(prev => ({
      ...prev,
      apiSettings: {
        ...prev.apiSettings,
        [provider]: {
          ...prev.apiSettings[provider as keyof typeof prev.apiSettings],
          [field]: value,
        },
      },
    }));
  };

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">
          プロジェクト設定: {folderName}
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        >
          <Tab label="システムプロンプト" />
          <Tab label="API設定" />
          <Tab label="詳細設定" />
        </Tabs>

        {/* システムプロンプトタブ */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              システムプロンプト設定
            </Typography>
            
            {/* テンプレート選択 */}
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              テンプレートから選択:
            </Typography>
            <Stack spacing={1} sx={{ mb: 3 }}>
              {DEFAULT_SYSTEM_PROMPTS.map((template, index) => (
                <Card
                  key={index}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => handlePromptTemplateSelect(template)}
                >
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.prompt.substring(0, 100)}...
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* カスタムプロンプト */}
            <TextField
              fullWidth
              multiline
              rows={8}
              label="システムプロンプト"
              value={settings.systemPrompt}
              onChange={(e) => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
              placeholder="AIの役割と動作を定義するプロンプトを入力してください..."
              sx={{ mb: 3 }}
            />

            {/* プロンプト変数 */}
            <Typography variant="subtitle2" gutterBottom>
              プロンプト変数
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              プロンプト内で {`{{変数名}}`} の形式で使用できます
            </Alert>

            <Stack spacing={2}>
              {Object.entries(settings.promptVariables).map(([key, value]) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`{{${key}}}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <TextField
                    size="small"
                    value={value}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      promptVariables: { ...prev.promptVariables, [key]: e.target.value }
                    }))}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveVariable(key)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="変数名"
                  value={newVariableKey}
                  onChange={(e) => setNewVariableKey(e.target.value)}
                />
                <TextField
                  size="small"
                  placeholder="デフォルト値"
                  value={newVariableValue}
                  onChange={(e) => setNewVariableValue(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  onClick={handleAddVariable}
                  disabled={!newVariableKey || !newVariableValue}
                  startIcon={<AddIcon />}
                >
                  追加
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {/* API設定タブ */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              API連携設定
            </Typography>

            {/* Shopify API */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.apiSettings.shopify?.enabled || false}
                      onChange={(e) => handleApiSettingChange('shopify', 'enabled', e.target.checked)}
                    />
                  }
                  label="Shopify API"
                  onClick={(e) => e.stopPropagation()}
                />
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Store URL"
                    value={settings.apiSettings.shopify?.storeUrl || ''}
                    onChange={(e) => handleApiSettingChange('shopify', 'storeUrl', e.target.value)}
                    placeholder="your-store.myshopify.com"
                  />
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="API Key"
                      type={showApiKeys.shopifyKey ? 'text' : 'password'}
                      value={settings.apiSettings.shopify?.apiKey || ''}
                      onChange={(e) => handleApiSettingChange('shopify', 'apiKey', e.target.value)}
                      placeholder="sk_..."
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('shopifyKey')}
                    >
                      {showApiKeys.shopifyKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="Access Token"
                      type={showApiKeys.shopifyToken ? 'text' : 'password'}
                      value={settings.apiSettings.shopify?.accessToken || ''}
                      onChange={(e) => handleApiSettingChange('shopify', 'accessToken', e.target.value)}
                      placeholder="shpat_..."
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('shopifyToken')}
                    >
                      {showApiKeys.shopifyToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Amazon SP-API */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.apiSettings.amazon?.enabled || false}
                      onChange={(e) => handleApiSettingChange('amazon', 'enabled', e.target.checked)}
                    />
                  }
                  label="Amazon SP-API"
                  onClick={(e) => e.stopPropagation()}
                />
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Seller ID"
                    value={settings.apiSettings.amazon?.sellerId || ''}
                    onChange={(e) => handleApiSettingChange('amazon', 'sellerId', e.target.value)}
                  />
                  <TextField
                    fullWidth
                    label="Marketplace ID"
                    value={settings.apiSettings.amazon?.marketplaceId || ''}
                    onChange={(e) => handleApiSettingChange('amazon', 'marketplaceId', e.target.value)}
                    placeholder="A1VC38T7YXB528"
                  />
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="Auth Token"
                      type={showApiKeys.amazonToken ? 'text' : 'password'}
                      value={settings.apiSettings.amazon?.authToken || ''}
                      onChange={(e) => handleApiSettingChange('amazon', 'authToken', e.target.value)}
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('amazonToken')}
                    >
                      {showApiKeys.amazonToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* 楽天 RMS API */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.apiSettings.rakuten?.enabled || false}
                      onChange={(e) => handleApiSettingChange('rakuten', 'enabled', e.target.checked)}
                    />
                  }
                  label="楽天 RMS API"
                  onClick={(e) => e.stopPropagation()}
                />
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="Service Secret"
                      type={showApiKeys.rakutenSecret ? 'text' : 'password'}
                      value={settings.apiSettings.rakuten?.serviceSecret || ''}
                      onChange={(e) => handleApiSettingChange('rakuten', 'serviceSecret', e.target.value)}
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('rakutenSecret')}
                    >
                      {showApiKeys.rakutenSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="License Key"
                      type={showApiKeys.rakutenLicense ? 'text' : 'password'}
                      value={settings.apiSettings.rakuten?.licenseKey || ''}
                      onChange={(e) => handleApiSettingChange('rakuten', 'licenseKey', e.target.value)}
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('rakutenLicense')}
                    >
                      {showApiKeys.rakutenLicense ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* NextEngine API */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.apiSettings.nextengine?.enabled || false}
                      onChange={(e) => handleApiSettingChange('nextengine', 'enabled', e.target.checked)}
                    />
                  }
                  label="NextEngine API"
                  onClick={(e) => e.stopPropagation()}
                />
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="UID"
                    value={settings.apiSettings.nextengine?.uid || ''}
                    onChange={(e) => handleApiSettingChange('nextengine', 'uid', e.target.value)}
                  />
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      fullWidth
                      label="Password"
                      type={showApiKeys.nextenginePassword ? 'text' : 'password'}
                      value={settings.apiSettings.nextengine?.pwd || ''}
                      onChange={(e) => handleApiSettingChange('nextengine', 'pwd', e.target.value)}
                    />
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                      onClick={() => toggleApiKeyVisibility('nextenginePassword')}
                    >
                      {showApiKeys.nextenginePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* 詳細設定タブ */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              詳細設定
            </Typography>
            <Typography variant="body2" color="text.secondary">
              今後のアップデートで追加予定の機能です。
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{ bgcolor: '#1ABC9C' }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};