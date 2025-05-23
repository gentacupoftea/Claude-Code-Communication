import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Paper,
  Snackbar
} from '@mui/material';
// import { LoadingButton } from '@mui/lab';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
  DataUsage as DataUsageIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useCacheManagement } from '../../hooks/useCacheManagement';
import { CacheSettings } from '../../api/cacheService';
import { formatBytes, formatDuration } from '../../utils/format';

/**
 * キャッシュクリアダイアログコンポーネント
 */
interface ClearCacheDialogProps {
  open: boolean;
  onClose: () => void;
  onClear: (options: {
    platform?: string;
    endpoint?: string;
    olderThan?: string;
  }) => Promise<void>;
  platforms: string[];
  loading: boolean;
}

const ClearCacheDialog: React.FC<ClearCacheDialogProps> = ({
  open,
  onClose,
  onClear,
  platforms,
  loading
}) => {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<string>('');
  const [endpoint, setEndpoint] = useState<string>('');
  const [olderThan, setOlderThan] = useState<string>('');
  
  // フォームリセット
  const resetForm = () => {
    setPlatform('');
    setEndpoint('');
    setOlderThan('');
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  const handleClear = async () => {
    const options: any = {};
    if (platform) options.platform = platform;
    if (endpoint) options.endpoint = endpoint;
    if (olderThan) options.olderThan = olderThan;
    
    await onClear(options);
    handleClose();
  };
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('cache.clearCacheTitle')}
        <IconButton
          aria-label="info"
          size="small"
          sx={{ ml: 1 }}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('cache.clearCacheDescription')}
        </DialogContentText>
        
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('cache.clearCacheWarning')}
        </Alert>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="platform-select-label">{t('cache.selectPlatform')}</InputLabel>
              <Select
                labelId="platform-select-label"
                value={platform}
                label={t('cache.selectPlatform')}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <MenuItem value="">{t('cache.allPlatforms')}</MenuItem>
                {platforms.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('cache.endpointPattern')}
              placeholder="/api/v1/products/*"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              helperText={t('cache.endpointPatternHelp')}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('cache.olderThan')}
              type="datetime-local"
              value={olderThan}
              onChange={(e) => setOlderThan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={t('cache.olderThanHelp')}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={loading}
          onClick={handleClear}
          color="error"
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {loading ? t('common.loading') : t('cache.clearCache')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * エンドポイント設定コンポーネント
 */
interface EndpointSettingsProps {
  settings: Record<string, { enabled: boolean; ttlSeconds: number }>;
  onChange: (key: string, value: { enabled: boolean; ttlSeconds: number }) => void;
  disabled?: boolean;
}

const EndpointSettings: React.FC<EndpointSettingsProps> = ({
  settings,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {t('cache.endpointSettings')}
      </Typography>
      
      <List dense>
        {Object.entries(settings).map(([endpoint, setting]) => (
          <ListItem key={endpoint} divider sx={{ py: 1 }}>
            <ListItemText
              primary={endpoint}
              secondary={
                <React.Fragment>
                  <Typography variant="caption" component="span" color="text.secondary">
                    TTL: {formatDuration(setting.ttlSeconds)}
                  </Typography>
                  <Chip
                    size="small"
                    label={setting.enabled ? t('cache.enabled') : t('cache.disabled')}
                    color={setting.enabled ? 'success' : 'default'}
                    sx={{ ml: 1, height: 20 }}
                  />
                </React.Fragment>
              }
            />
            <Box display="flex" alignItems="center">
              <TextField
                size="small"
                type="number"
                label="TTL (秒)"
                value={setting.ttlSeconds}
                onChange={(e) => onChange(endpoint, { ...setting, ttlSeconds: parseInt(e.target.value) || 0 })}
                sx={{ width: 100, mr: 2 }}
                disabled={disabled}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={setting.enabled}
                    onChange={(e) => onChange(endpoint, { ...setting, enabled: e.target.checked })}
                    disabled={disabled}
                    size="small"
                  />
                }
                label={setting.enabled ? t('cache.enabled') : t('cache.disabled')}
              />
            </Box>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

/**
 * プラットフォーム設定コンポーネント
 */
interface PlatformSettingsProps {
  settings: Record<string, { enabled: boolean; ttlSeconds: number }>;
  onChange: (key: string, value: { enabled: boolean; ttlSeconds: number }) => void;
  disabled?: boolean;
}

const PlatformSettings: React.FC<PlatformSettingsProps> = ({
  settings,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {t('cache.platformSettings')}
      </Typography>
      
      <Grid container spacing={2}>
        {Object.entries(settings).map(([platform, setting]) => (
          <Grid item xs={12} sm={6} md={4} key={platform}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">{platform}</Typography>
                  <Chip
                    size="small"
                    label={setting.enabled ? t('cache.enabled') : t('cache.disabled')}
                    color={setting.enabled ? 'success' : 'default'}
                  />
                </Box>
                
                <Box display="flex" alignItems="center" mt={2}>
                  <TextField
                    size="small"
                    type="number"
                    label="TTL (秒)"
                    value={setting.ttlSeconds}
                    onChange={(e) => onChange(platform, { ...setting, ttlSeconds: parseInt(e.target.value) || 0 })}
                    sx={{ width: '100%', mr: 2 }}
                    disabled={disabled}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={setting.enabled}
                        onChange={(e) => onChange(platform, { ...setting, enabled: e.target.checked })}
                        disabled={disabled}
                        size="small"
                      />
                    }
                    label=""
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

/**
 * キャッシュコントロールパネルコンポーネント
 */
const CacheControlPanel: React.FC = () => {
  const { t } = useTranslation();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{ 
    open: boolean; 
    message: string; 
    severity: 'success' | 'error' | 'info' | 'warning' 
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // 編集用の設定を分離して状態管理
  const [editableSettings, setEditableSettings] = useState<CacheSettings | null>(null);
  const [statusInfo, setStatusInfo] = useState<{
    healthy: boolean;
    connected: boolean;
    version: string;
    uptime: number;
  } | null>(null);
  
  const {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
    clearCache,
    checkStatus
  } = useCacheManagement();
  
  // 初期データロード
  useEffect(() => {
    fetchSettings();
    handleStatusCheck();
  }, [fetchSettings]);
  
  // 設定が変更されたら編集可能な設定も更新
  useEffect(() => {
    if (settings) {
      setEditableSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);
  
  // 通知を閉じる
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  // 設定の変更をハンドリング
  const handleSettingChange = (field: keyof CacheSettings, value: any) => {
    if (!editableSettings) return;
    
    setEditableSettings({
      ...editableSettings,
      [field]: value
    });
  };
  
  // エンドポイント設定の変更をハンドリング
  const handleEndpointSettingChange = (endpoint: string, value: { enabled: boolean; ttlSeconds: number }) => {
    if (!editableSettings) return;
    
    setEditableSettings({
      ...editableSettings,
      endpointSettings: {
        ...editableSettings.endpointSettings,
        [endpoint]: value
      }
    });
  };
  
  // プラットフォーム設定の変更をハンドリング
  const handlePlatformSettingChange = (platform: string, value: { enabled: boolean; ttlSeconds: number }) => {
    if (!editableSettings) return;
    
    setEditableSettings({
      ...editableSettings,
      platformSettings: {
        ...editableSettings.platformSettings,
        [platform]: value
      }
    });
  };
  
  // 設定を保存
  const handleSaveSettings = async () => {
    if (!editableSettings) return;
    
    try {
      await updateSettings(editableSettings);
      setNotification({
        open: true,
        message: t('cache.settingsSaved'),
        severity: 'success'
      });
    } catch (err) {
      setNotification({
        open: true,
        message: t('cache.settingsSaveError'),
        severity: 'error'
      });
      console.error(err);
    }
  };
  
  // キャッシュクリア
  const handleClearCache = async (options: any) => {
    try {
      const result = await clearCache(options);
      if (result?.success) {
        setNotification({
          open: true,
          message: t('cache.clearCacheSuccess', { count: result.clearedItems }),
          severity: 'success'
        });
      }
    } catch (err) {
      setNotification({
        open: true,
        message: t('cache.clearCacheError'),
        severity: 'error'
      });
      console.error(err);
    }
  };
  
  // キャッシュのステータスを確認
  const handleStatusCheck = async () => {
    try {
      const status = await checkStatus();
      if (status) {
        setStatusInfo(status);
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
  };
  
  // プラットフォームの一覧を取得
  const getPlatforms = (): string[] => {
    if (!settings) return [];
    return Object.keys(settings.platformSettings);
  };
  
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          {t('cache.controlTitle')}
        </Typography>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSettings}
            disabled={loading}
            size="small"
            sx={{ mr: 1 }}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setClearDialogOpen(true)}
            disabled={loading}
            size="small"
          >
            {t('cache.clearCache')}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.message}
        </Alert>
      )}
      
      {/* キャッシュステータス */}
      {statusInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h6" mr={2}>
                {t('cache.status')}
              </Typography>
              <Chip
                icon={statusInfo.healthy ? <CheckCircleIcon /> : <WarningIcon />}
                label={statusInfo.healthy ? t('cache.healthy') : t('cache.unhealthy')}
                color={statusInfo.healthy ? 'success' : 'error'}
              />
              <Chip
                icon={statusInfo.connected ? <CheckCircleIcon /> : <BlockIcon />}
                label={statusInfo.connected ? t('cache.connected') : t('cache.disconnected')}
                color={statusInfo.connected ? 'success' : 'error'}
                sx={{ ml: 1 }}
              />
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  {t('cache.version')}: <strong>{statusInfo.version}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  {t('cache.uptime')}: <strong>{formatDuration(statusInfo.uptime)}</strong>
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* グローバル設定 */}
      <Box mb={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <SettingsIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">
                {t('cache.globalSettings')}
              </Typography>
            </Box>
            
            {loading ? (
              <Box display="flex" justifyContent="center" my={4}>
                <CircularProgress />
              </Box>
            ) : (
              editableSettings && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editableSettings.enabled}
                          onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={t('cache.enableCache')}
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      {t('cache.enableCacheDescription')}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label={t('cache.ttl')}
                      type="number"
                      value={editableSettings.ttlSeconds}
                      onChange={(e) => handleSettingChange('ttlSeconds', parseInt(e.target.value) || 0)}
                      helperText={t('cache.ttlDescription')}
                      InputProps={{
                        endAdornment: <Typography variant="caption">秒</Typography>
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label={t('cache.maxSize')}
                      type="number"
                      value={editableSettings.maxSizeBytes / (1024 * 1024)}
                      onChange={(e) => handleSettingChange('maxSizeBytes', (parseInt(e.target.value) || 0) * 1024 * 1024)}
                      helperText={t('cache.maxSizeDescription')}
                      InputProps={{
                        endAdornment: <Typography variant="caption">MB</Typography>
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editableSettings.compressionEnabled}
                          onChange={(e) => handleSettingChange('compressionEnabled', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={t('cache.enableCompression')}
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      {t('cache.compressionDescription')}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editableSettings.preferCache}
                          onChange={(e) => handleSettingChange('preferCache', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={t('cache.preferCache')}
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      {t('cache.preferCacheDescription')}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label={t('cache.refreshInterval')}
                      type="number"
                      value={editableSettings.refreshInterval}
                      onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value) || 0)}
                      helperText={t('cache.refreshIntervalDescription')}
                      InputProps={{
                        endAdornment: <Typography variant="caption">分</Typography>
                      }}
                    />
                  </Grid>
                </Grid>
              )
            )}
          </CardContent>
        </Card>
      </Box>
      
      {/* 詳細設定 */}
      {editableSettings && (
        <Box mb={3}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="platform-settings-content"
              id="platform-settings-header"
            >
              <Typography variant="subtitle1">
                {t('cache.platformSpecificSettings')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <PlatformSettings
                settings={editableSettings.platformSettings}
                onChange={handlePlatformSettingChange}
                disabled={loading}
              />
            </AccordionDetails>
          </Accordion>
          
          <Accordion defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="endpoint-settings-content"
              id="endpoint-settings-header"
            >
              <Typography variant="subtitle1">
                {t('cache.endpointSpecificSettings')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <EndpointSettings
                settings={editableSettings.endpointSettings}
                onChange={handleEndpointSettingChange}
                disabled={loading}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
      
      {/* 保存ボタン */}
      <Box display="flex" justifyContent="flex-end" mt={3}>
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSaveSettings}
          disabled={loading || !editableSettings}
        >
          {loading ? t('common.loading') : t('cache.saveSettings')}
        </Button>
      </Box>
      
      {/* キャッシュクリアダイアログ */}
      <ClearCacheDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        onClear={handleClearCache}
        platforms={getPlatforms()}
        loading={loading}
      />
      
      {/* 通知 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CacheControlPanel;