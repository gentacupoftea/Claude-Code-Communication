/**
 * 詳細設定コンポーネント
 * 
 * アプリケーションの詳細設定とデータ管理オプション
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Grid,
  Divider,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Info as InfoIcon,
  ExpandMore,
  Backup,
  Delete,
  SystemUpdateAlt,
  FileUpload,
  Code,
  Storage,
  Tune,
  NetworkCheck,
  ClearAll,
  LightbulbOutlined,
  WarningAmber,
  TerminalOutlined,
  AccessTime,
  Save,
  RestartAlt,
} from '@mui/icons-material';
import { useSettings, AdvancedSettings as AdvancedSettingsType } from '../../hooks/useSettings';

const AdvancedSettings: React.FC = () => {
  const { 
    advancedSettings,
    saveAdvancedSettings,
    exportSettings,
    importSettings,
    resetSettings,
    dataRefreshInterval,
    setDataRefreshIntervalPreference,
  } = useSettings();
  
  const [localAdvancedSettings, setLocalAdvancedSettings] = useState<AdvancedSettingsType>({
    ...advancedSettings
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // インポートファイル選択ハンドラー
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result as string;
        const success = importSettings(fileContent);
        
        if (!success) {
          setImportError('設定のインポートに失敗しました。ファイル形式が正しくありません。');
        }
      } catch (error) {
        setImportError(`設定のインポートエラー: ${(error as Error).message}`);
      }
    };
    
    reader.onerror = () => {
      setImportError('ファイルの読み込みに失敗しました。');
    };
    
    reader.readAsText(file);
  };
  
  // 詳細設定の更新ハンドラー
  const handleAdvancedSettingChange = (
    section: keyof AdvancedSettingsType,
    key: string,
    value: any
  ) => {
    if (typeof section === 'object') {
      setLocalAdvancedSettings({
        ...localAdvancedSettings,
        [key]: value
      });
    } else {
      const sectionSettings = localAdvancedSettings[section];
      if (typeof sectionSettings === 'object' && sectionSettings !== null) {
        setLocalAdvancedSettings({
          ...localAdvancedSettings,
          [section]: {
            ...sectionSettings,
            [key]: value
          }
        });
      }
    }
  };
  
  // 設定の保存
  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      saveAdvancedSettings(localAdvancedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  // リセット確認
  const handleResetConfirm = () => {
    setResetConfirmOpen(true);
  };
  
  // 設定リセット実行
  const handleResetSettings = () => {
    resetSettings();
    setLocalAdvancedSettings({
      ...advancedSettings
    });
    setResetConfirmOpen(false);
  };
  
  // データ更新間隔のフォーマット
  const formatDataRefreshInterval = (value: number) => {
    if (value === 0) return '手動更新のみ';
    if (value < 60) return `${value}秒ごと`;
    if (value < 3600) return `${Math.floor(value / 60)}分ごと`;
    return `${Math.floor(value / 3600)}時間ごと`;
  };
  
  return (
    <Box>
      {/* 保存成功メッセージ */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          詳細設定が保存されました
        </Alert>
      )}
      
      {/* インポートエラー */}
      {importError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {importError}
        </Alert>
      )}
      
      {/* パフォーマンス設定 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Tune />
        データと更新設定
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle1" gutterBottom>
                  データ更新間隔
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ダッシュボードとデータ画面の自動更新間隔を設定します
                </Typography>
                <Box sx={{ px: 2, mt: 2 }}>
                  <Slider
                    value={dataRefreshInterval}
                    onChange={(_, value) => setDataRefreshIntervalPreference(value as any)}
                    step={null}
                    marks={[
                      { value: 0, label: '手動' },
                      { value: 30, label: '30秒' },
                      { value: 60, label: '1分' },
                      { value: 300, label: '5分' },
                      { value: 600, label: '10分' },
                      { value: 1800, label: '30分' },
                      { value: 3600, label: '1時間' },
                    ]}
                    min={0}
                    max={3600}
                    valueLabelDisplay="auto"
                    valueLabelFormat={formatDataRefreshInterval}
                  />
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.batchRequests}
                    onChange={(e) => handleAdvancedSettingChange('batchRequests', 'batchRequests', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">リクエストのバッチ処理</Typography>
                    <Typography variant="body2" color="text.secondary">
                      複数のAPI呼び出しを可能な限りまとめて処理して効率化します
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.preloadDashboard}
                    onChange={(e) => handleAdvancedSettingChange('preloadDashboard', 'preloadDashboard', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">ダッシュボード事前読み込み</Typography>
                    <Typography variant="body2" color="text.secondary">
                      バックグラウンドでダッシュボードデータを事前に読み込みます
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            キャッシュ設定
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.cacheSettings.enabled}
                    onChange={(e) => handleAdvancedSettingChange('cacheSettings', 'enabled', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">データキャッシュを有効化</Typography>
                    <Typography variant="body2" color="text.secondary">
                      アプリケーションのパフォーマンスを向上させるためにデータをキャッシュします
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!localAdvancedSettings.cacheSettings.enabled}>
                <InputLabel>キャッシュ有効期限</InputLabel>
                <Select
                  value={localAdvancedSettings.cacheSettings.maxAge}
                  onChange={(e) => handleAdvancedSettingChange('cacheSettings', 'maxAge', Number(e.target.value))}
                  label="キャッシュ有効期限"
                >
                  <MenuItem value={60}>1分</MenuItem>
                  <MenuItem value={300}>5分</MenuItem>
                  <MenuItem value={900}>15分</MenuItem>
                  <MenuItem value={1800}>30分</MenuItem>
                  <MenuItem value={3600}>1時間</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.cacheSettings.staleWhileRevalidate}
                    onChange={(e) => handleAdvancedSettingChange('cacheSettings', 'staleWhileRevalidate', e.target.checked)}
                    disabled={!localAdvancedSettings.cacheSettings.enabled}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Stale-While-Revalidate</Typography>
                    <Typography variant="body2" color="text.secondary">
                      古いデータを表示しながら、バックグラウンドで新しいデータを取得します
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.cacheSettings.persistToStorage}
                    onChange={(e) => handleAdvancedSettingChange('cacheSettings', 'persistToStorage', e.target.checked)}
                    disabled={!localAdvancedSettings.cacheSettings.enabled}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">キャッシュの永続化</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ページの再読み込み後もキャッシュを保持します
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<ClearAll />}
                  disabled={!localAdvancedSettings.cacheSettings.enabled}
                >
                  キャッシュをクリア
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 接続設定 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <NetworkCheck />
        接続設定
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.connectionSettings.autoReconnect}
                    onChange={(e) => handleAdvancedSettingChange('connectionSettings', 'autoReconnect', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">自動再接続</Typography>
                    <Typography variant="body2" color="text.secondary">
                      接続が切れた場合に自動的に再接続を試みます
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth disabled={!localAdvancedSettings.connectionSettings.autoReconnect}>
                <InputLabel>再接続間隔</InputLabel>
                <Select
                  value={localAdvancedSettings.connectionSettings.reconnectInterval}
                  onChange={(e) => handleAdvancedSettingChange('connectionSettings', 'reconnectInterval', Number(e.target.value))}
                  label="再接続間隔"
                >
                  <MenuItem value={1}>1秒</MenuItem>
                  <MenuItem value={3}>3秒</MenuItem>
                  <MenuItem value={5}>5秒</MenuItem>
                  <MenuItem value={10}>10秒</MenuItem>
                  <MenuItem value={30}>30秒</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth disabled={!localAdvancedSettings.connectionSettings.autoReconnect}>
                <InputLabel>再接続試行回数</InputLabel>
                <Select
                  value={localAdvancedSettings.connectionSettings.maxReconnectAttempts}
                  onChange={(e) => handleAdvancedSettingChange('connectionSettings', 'maxReconnectAttempts', Number(e.target.value))}
                  label="再接続試行回数"
                >
                  <MenuItem value={1}>1回</MenuItem>
                  <MenuItem value={3}>3回</MenuItem>
                  <MenuItem value={5}>5回</MenuItem>
                  <MenuItem value={10}>10回</MenuItem>
                  <MenuItem value={-1}>無制限</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Ping間隔</InputLabel>
                <Select
                  value={localAdvancedSettings.connectionSettings.pingInterval}
                  onChange={(e) => handleAdvancedSettingChange('connectionSettings', 'pingInterval', Number(e.target.value))}
                  label="Ping間隔"
                >
                  <MenuItem value={10}>10秒</MenuItem>
                  <MenuItem value={30}>30秒</MenuItem>
                  <MenuItem value={60}>1分</MenuItem>
                  <MenuItem value={300}>5分</MenuItem>
                  <MenuItem value={0}>無効</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* デバッグ設定 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Code />
        デバッグと開発者設定
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.debugMode}
                    onChange={(e) => handleAdvancedSettingChange('debugMode', 'debugMode', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">デバッグモード</Typography>
                    <Typography variant="body2" color="text.secondary">
                      開発者情報とデバッグ機能を有効にします
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>ログレベル</InputLabel>
                <Select
                  value={localAdvancedSettings.logLevel}
                  onChange={(e) => handleAdvancedSettingChange('logLevel', 'logLevel', e.target.value)}
                  label="ログレベル"
                >
                  <MenuItem value="error">エラーのみ</MenuItem>
                  <MenuItem value="warn">警告以上</MenuItem>
                  <MenuItem value="info">情報以上</MenuItem>
                  <MenuItem value="debug">デバッグ以上</MenuItem>
                  <MenuItem value="trace">すべて (トレース)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localAdvancedSettings.enableExperimentalFeatures}
                    onChange={(e) => handleAdvancedSettingChange('enableExperimentalFeatures', 'enableExperimentalFeatures', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">
                      実験的機能
                      <Tooltip title="実験的な機能は不安定な場合があります">
                        <WarningAmber color="warning" fontSize="small" sx={{ ml: 1 }} />
                      </Tooltip>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      開発中の新機能をプレビューします
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          
          {localAdvancedSettings.debugMode && (
            <Box sx={{ mt: 3 }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                    <TerminalOutlined sx={{ mr: 1 }} />
                    開発者ツール
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    これらのツールは開発者向けです。予期しない問題が発生する可能性があります。
                  </Alert>
                  
                  <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Button variant="outlined" size="small">
                      アプリケーションログを表示
                    </Button>
                    <Button variant="outlined" size="small">
                      ネットワークリクエストを監視
                    </Button>
                    <Button variant="outlined" size="small">
                      パフォーマンス測定
                    </Button>
                  </Stack>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="カスタムJavaScriptを実行..."
                    sx={{ fontFamily: 'monospace' }}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>
      
      {/* 設定管理 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Storage />
        設定管理
      </Typography>
      
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SystemUpdateAlt />}
                onClick={exportSettings}
              >
                設定をエクスポート
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                component="label"
                startIcon={<FileUpload />}
              >
                設定をインポート
                <input
                  type="file"
                  hidden
                  accept=".json"
                  onChange={handleImportFile}
                />
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<RestartAlt />}
                onClick={handleResetConfirm}
              >
                設定をリセット
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 保存ボタン */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <Save />}
          onClick={handleSaveSettings}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '設定を保存'}
        </Button>
      </Box>
      
      {/* リセット確認ダイアログ */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
      >
        <DialogTitle>設定をリセットしますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            すべての設定がデフォルト値にリセットされます。この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleResetSettings} color="error" autoFocus>
            リセット
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedSettings;