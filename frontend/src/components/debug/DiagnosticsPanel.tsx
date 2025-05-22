/**
 * 診断パネルコンポーネント
 * アプリケーションの診断情報を表示するモーダルパネル
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Alert,
  LinearProgress,
  CircularProgress,
  Grid
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Dns as NetworkIcon,
  Memory as MemoryIcon,
  Assessment as AssessmentIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { useConnection } from '../../hooks/useConnection';

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
      id={`diagnostics-tabpanel-${index}`}
      aria-labelledby={`diagnostics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

interface DiagnosticsPanelProps {
  open: boolean;
  onClose: () => void;
}

const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);
  const [filterValue, setFilterValue] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const {
    logs,
    summary,
    appInfo,
    environment,
    performanceMetrics,
    clearLogs,
    refreshAllDiagnostics
  } = useDiagnostics();

  const { 
    isOnline, 
    connectionType, 
    connectionQuality,
    apiEndpoint,
    lastChecked,
    testConnectionQuality
  } = useConnection();

  // タブの変更ハンドラー
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // ログの展開/折りたたみトグル
  const toggleLogExpand = (logId: string) => {
    setExpandedLogs(prev => {
      if (prev.includes(logId)) {
        return prev.filter(id => id !== logId);
      } else {
        return [...prev, logId];
      }
    });
  };

  // フィルター変更ハンドラー
  const handleFilterChange = (event: SelectChangeEvent) => {
    setFilterValue(event.target.value);
  };

  // 検索ハンドラー
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // ログのフィルタリング
  const filteredLogs = logs
    .filter(log => {
      if (filterValue === 'all') return true;
      return log.level === filterValue;
    })
    .filter(log => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(term) ||
        log.module.toLowerCase().includes(term) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(term))
      );
    });

  // すべてのログを展開
  const expandAllLogs = () => {
    setExpandedLogs(filteredLogs.map(log => log.id));
  };

  // すべてのログを折りたたみ
  const collapseAllLogs = () => {
    setExpandedLogs([]);
  };

  // 診断レポートのダウンロード
  const downloadDiagnosticsReport = () => {
    setIsGeneratingReport(true);
    
    setTimeout(() => {
      try {
        const reportData = {
          appInfo,
          environment,
          summary,
          performance: performanceMetrics,
          connection: {
            isOnline,
            connectionType,
            connectionQuality,
            apiEndpoint,
            lastChecked
          },
          logs: logs.slice(-100) // 最新100件のログ
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], {
          type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagnostics-report-${new Date().toISOString()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('診断レポートの生成中にエラーが発生しました', error);
      } finally {
        setIsGeneratingReport(false);
      }
    }, 500);
  };

  // コピーボタンのハンドラー
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('クリップボードへのコピーに失敗しました', err);
    });
  };

  // 接続テストのハンドラー
  const handleTestConnection = async () => {
    try {
      await testConnectionQuality();
    } catch (error) {
      console.error('接続テスト中にエラーが発生しました', error);
    }
  };

  // 情報カードレンダラー
  const renderInfoCard = (title: string, content: React.ReactNode) => (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {content}
    </Paper>
  );

  // ログブロックのレンダリング
  const renderLogItem = (log: any) => {
    const isExpanded = expandedLogs.includes(log.id);
    
    const getLogIcon = () => {
      switch (log.level) {
        case 'error':
          return <ErrorIcon color="error" fontSize="small" />;
        case 'warn':
          return <WarningIcon color="warning" fontSize="small" />;
        case 'info':
          return <InfoIcon color="info" fontSize="small" />;
        default:
          return <InfoIcon color="disabled" fontSize="small" />;
      }
    };
    
    const getLogColor = () => {
      switch (log.level) {
        case 'error':
          return theme.palette.error.main;
        case 'warn':
          return theme.palette.warning.main;
        case 'info':
          return theme.palette.info.main;
        default:
          return theme.palette.text.secondary;
      }
    };
    
    return (
      <Paper
        key={log.id}
        variant="outlined"
        sx={{
          mb: 1,
          borderLeft: `4px solid ${getLogColor()}`,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
        }}
      >
        <Box
          onClick={() => toggleLogExpand(log.id)}
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {getLogIcon()}
            <Typography
              variant="body2"
              sx={{
                color: getLogColor(),
                fontWeight: log.level === 'error' ? 'bold' : 'normal',
              }}
            >
              {log.message}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={log.module}
              size="small"
              sx={{ fontSize: '0.65rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              {new Date(log.timestamp).toLocaleTimeString()}
            </Typography>
            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        </Box>
        
        {isExpanded && (
          <Box sx={{ p: 1, pt: 0, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  モジュール: {log.module} | 
                  レベル: {log.level} | 
                  時間: {new Date(log.timestamp).toLocaleString()}
                </Typography>
              </Grid>
              
              {log.details && (
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    詳細情報:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                    <pre style={{ margin: 0, fontSize: '0.7rem', overflow: 'auto', maxHeight: '100px' }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </Paper>
                </Grid>
              )}
              
              {log.stack && (
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    スタックトレース:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                    <pre style={{ margin: 0, fontSize: '0.7rem', overflow: 'auto', maxHeight: '100px' }}>
                      {log.stack}
                    </pre>
                  </Paper>
                </Grid>
              )}
              
              <Grid item xs={12} sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyToClipboard(JSON.stringify(log, null, 2));
                  }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <BugIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">診断パネル</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label="診断タブ"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab label="概要" />
        <Tab label="ログ" />
        <Tab label="環境" />
        <Tab label="パフォーマンス" />
      </Tabs>
      
      <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 概要タブ */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "アプリケーション情報",
                <List dense disablePadding>
                  <ListItem>
                    <ListItemText primary="バージョン" secondary={appInfo.version || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="環境" secondary={appInfo.environment || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="ビルド日時" secondary={appInfo.buildDate || '不明'} />
                  </ListItem>
                </List>
              )}
              
              {renderInfoCard(
                "接続状態",
                <Box>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Chip
                      label={isOnline ? 'オンライン' : 'オフライン'}
                      color={isOnline ? 'success' : 'error'}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Typography variant="body2">
                      {connectionType === 'unknown' ? '接続タイプ: 不明' : `接続タイプ: ${connectionType}`}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" gutterBottom>
                    接続品質: {connectionQuality}
                    {lastChecked && ` (最終チェック: ${lastChecked.toLocaleTimeString()})`}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    API エンドポイント: {apiEndpoint || '不明'}
                  </Typography>
                  
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleTestConnection}
                  >
                    接続テスト
                  </Button>
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "概要統計",
                <List dense disablePadding>
                  <ListItem>
                    <ListItemText
                      primary="ログ件数"
                      secondary={`${logs.length} 件（エラー: ${summary.errorCount || 0}、警告: ${
                        summary.warnCount || 0
                      }、情報: ${summary.infoCount || 0}）`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="最近のエラー"
                      secondary={`過去24時間: ${summary.recentErrors || 0} 件`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="アプリ起動時間"
                      secondary={appInfo.startTime ? new Date(appInfo.startTime).toLocaleString() : '不明'}
                    />
                  </ListItem>
                </List>
              )}
              
              {renderInfoCard(
                "パフォーマンス概要",
                <List dense disablePadding>
                  <ListItem>
                    <ListItemText
                      primary="メモリ使用量"
                      secondary={performanceMetrics.memory ? `${Math.round(performanceMetrics.memory)} MB` : '不明'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="平均レスポンス時間"
                      secondary={performanceMetrics.avgResponseTime ? `${performanceMetrics.avgResponseTime} ms` : '不明'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="API呼び出し回数"
                      secondary={performanceMetrics.apiCalls !== undefined ? `${performanceMetrics.apiCalls} 回` : '不明'}
                    />
                  </ListItem>
                </List>
              )}
              
              {renderInfoCard(
                "診断ツール",
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={refreshAllDiagnostics}
                  >
                    診断更新
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={downloadDiagnosticsReport}
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? '生成中...' : 'レポート出力'}
                  </Button>
                </Stack>
              )}
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* ログタブ */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>フィルター</InputLabel>
              <Select value={filterValue} onChange={handleFilterChange} label="フィルター">
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="error">エラー</MenuItem>
                <MenuItem value="warn">警告</MenuItem>
                <MenuItem value="info">情報</MenuItem>
                <MenuItem value="debug">デバッグ</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              size="small"
              placeholder="検索..."
              value={searchTerm}
              onChange={handleSearch}
              sx={{ flex: 1 }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<ExpandMoreIcon />}
                onClick={expandAllLogs}
              >
                すべて展開
              </Button>
              <Button
                size="small"
                startIcon={<ExpandLessIcon />}
                onClick={collapseAllLogs}
              >
                すべて折りたたみ
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={clearLogs}
              >
                クリア
              </Button>
            </Box>
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            ログ ({filteredLogs.length} 件)
          </Typography>
          
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {filteredLogs.length === 0 ? (
              <Alert severity="info">ログが見つかりません</Alert>
            ) : (
              filteredLogs
                .slice()
                .reverse()
                .map(log => renderLogItem(log))
            )}
          </Box>
        </TabPanel>
        
        {/* 環境タブ */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "ブラウザ情報",
                <List dense disablePadding>
                  <ListItem>
                    <ListItemText primary="ユーザーエージェント" secondary={environment.userAgent || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="言語" secondary={environment.language || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="画面解像度" secondary={
                      environment.screenWidth && environment.screenHeight
                        ? `${environment.screenWidth} x ${environment.screenHeight}`
                        : '不明'
                    } />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="ピクセル比" secondary={environment.devicePixelRatio || '不明'} />
                  </ListItem>
                </List>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "環境変数",
                <List dense disablePadding>
                  <ListItem>
                    <ListItemText primary="NODE_ENV" secondary={environment.nodeEnv || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="API URL" secondary={environment.apiUrl || '不明'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="WebSocket URL" secondary={environment.wsUrl || '不明'} />
                  </ListItem>
                </List>
              )}
              
              {renderInfoCard(
                "機能フラグ",
                <List dense disablePadding>
                  {environment.featureFlags && Object.entries(environment.featureFlags).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key}
                        secondary={typeof value === 'boolean' ? (value ? '有効' : '無効') : String(value)}
                      />
                    </ListItem>
                  ))}
                  {(!environment.featureFlags || Object.keys(environment.featureFlags).length === 0) && (
                    <ListItem>
                      <ListItemText primary="機能フラグがありません" />
                    </ListItem>
                  )}
                </List>
              )}
            </Grid>
            
            <Grid item xs={12}>
              {renderInfoCard(
                "ローカルストレージ概要",
                <Box>
                  <Typography variant="body2" gutterBottom>
                    使用中のキー: {environment.localStorageKeys?.length || 0} 個
                  </Typography>
                  
                  {environment.localStorageKeys && environment.localStorageKeys.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">キー一覧:</Typography>
                      <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default', mt: 0.5 }}>
                        <Box component="pre" sx={{ m: 0, fontSize: '0.7rem', overflow: 'auto', maxHeight: '100px' }}>
                          {environment.localStorageKeys.join('\n')}
                        </Box>
                      </Paper>
                    </Box>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* パフォーマンスタブ */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "メモリ使用量",
                <Box>
                  <Typography variant="body2" gutterBottom>
                    現在の使用量: {performanceMetrics.memory ? `${Math.round(performanceMetrics.memory)} MB` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    ヒープ制限: {performanceMetrics.heapLimit ? `${Math.round(performanceMetrics.heapLimit)} MB` : '不明'}
                  </Typography>
                  
                  {performanceMetrics.memory && performanceMetrics.heapLimit && (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          使用率: {Math.round((performanceMetrics.memory / performanceMetrics.heapLimit) * 100)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(performanceMetrics.memory / performanceMetrics.heapLimit) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  )}
                </Box>
              )}
              
              {renderInfoCard(
                "API パフォーマンス",
                <Box>
                  <Typography variant="body2" gutterBottom>
                    API呼び出し回数: {performanceMetrics.apiCalls !== undefined ? performanceMetrics.apiCalls : '不明'}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    平均レスポンス時間: {performanceMetrics.avgResponseTime ? `${performanceMetrics.avgResponseTime} ms` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    最大レスポンス時間: {performanceMetrics.maxResponseTime ? `${performanceMetrics.maxResponseTime} ms` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2">
                    API失敗回数: {performanceMetrics.apiErrors !== undefined ? performanceMetrics.apiErrors : '不明'}
                  </Typography>
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              {renderInfoCard(
                "レンダリングパフォーマンス",
                <Box>
                  <Typography variant="body2" gutterBottom>
                    ページ読み込み時間: {performanceMetrics.pageLoadTime ? `${performanceMetrics.pageLoadTime} ms` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    DOM インタラクティブ時間: {performanceMetrics.domInteractive ? `${performanceMetrics.domInteractive} ms` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    DOM コンテンツロード完了時間: {performanceMetrics.domContentLoaded ? `${performanceMetrics.domContentLoaded} ms` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2">
                    ページ読み込み完了時間: {performanceMetrics.pageLoadComplete ? `${performanceMetrics.pageLoadComplete} ms` : '不明'}
                  </Typography>
                </Box>
              )}
              
              {renderInfoCard(
                "リソース使用量",
                <Box>
                  <Typography variant="body2" gutterBottom>
                    ロードされたリソース: {performanceMetrics.resourceCount !== undefined ? performanceMetrics.resourceCount : '不明'} 個
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    合計リソースサイズ: {performanceMetrics.totalResourceSize ? `${Math.round(performanceMetrics.totalResourceSize / 1024)} KB` : '不明'}
                  </Typography>
                  
                  <Typography variant="body2">
                    キャッシュデータサイズ: {performanceMetrics.cacheSize ? `${Math.round(performanceMetrics.cacheSize / 1024)} KB` : '不明'}
                  </Typography>
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12}>
              {renderInfoCard(
                "リソース計測",
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={refreshAllDiagnostics}
                >
                  パフォーマンス計測を実行
                </Button>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiagnosticsPanel;
export { DiagnosticsPanel };