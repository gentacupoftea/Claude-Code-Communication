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
  Bug as BugIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Dns as NetworkIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { LogEntry, LogLevel, SystemInfo } from '../../services/diagnosticsService';

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
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `diagnostics-tab-${index}`,
    'aria-controls': `diagnostics-tabpanel-${index}`,
  };
}

interface DiagnosticsPanelProps {
  open: boolean;
  onClose: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [logFilter, setLogFilter] = useState<LogLevel[]>(['debug', 'info', 'warn', 'error']);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [uniqueModules, setUniqueModules] = useState<string[]>([]);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  
  const {
    logs,
    systemInfo,
    networkDiagnostics,
    performanceMetrics,
    summary,
    isOnline,
    refreshAllDiagnostics,
    exportDiagnostics,
    clearLogs,
    resetPerformanceMetrics
  } = useDiagnostics({ autoSubscribe: true });

  // タブの変更ハンドラ
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // ログレベルのフィルター変更
  const handleLogLevelChange = (level: LogLevel) => {
    setLogFilter(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      } else {
        return [...prev, level];
      }
    });
  };

  // モジュールフィルターの変更
  const handleModuleChange = (event: SelectChangeEvent) => {
    setModuleFilter(event.target.value);
  };

  // ログの展開/折りたたみ
  const toggleLogExpand = (logId: string) => {
    setExpandedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // すべての診断情報をエクスポート
  const handleExportDiagnostics = async () => {
    setIsDownloading(true);
    try {
      const data = exportDiagnostics();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagnostics-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export diagnostics:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // データの更新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAllDiagnostics();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ログのクリア
  const handleClearLogs = () => {
    clearLogs();
  };

  // パフォーマンスメトリクスのリセット
  const handleResetPerformanceMetrics = () => {
    resetPerformanceMetrics();
  };

  // 検索クエリに一致するかどうかを判定
  const matchesSearchQuery = (log: LogEntry) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.module.toLowerCase().includes(query) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(query)) ||
      (log.stack && log.stack.toLowerCase().includes(query))
    );
  };

  // フィルター条件に一致するログを取得
  const getFilteredLogs = () => {
    return logs.filter(log => 
      logFilter.includes(log.level) && 
      matchesSearchQuery(log) && 
      (moduleFilter === 'all' || log.module === moduleFilter)
    );
  };

  // システム情報表示用ヘルパー
  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ログレベルに応じたスタイルを取得
  const getLogLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return {
          color: theme.palette.error.main,
          icon: <ErrorIcon fontSize="small" color="error" />
        };
      case 'warn':
        return {
          color: theme.palette.warning.main,
          icon: <WarningIcon fontSize="small" color="warning" />
        };
      case 'info':
        return {
          color: theme.palette.info.main,
          icon: <InfoIcon fontSize="small" color="info" />
        };
      case 'debug':
        return {
          color: theme.palette.text.secondary,
          icon: <BugIcon fontSize="small" color="disabled" />
        };
    }
  };

  // ユニークなモジュール一覧を抽出
  useEffect(() => {
    const modules = new Set<string>();
    logs.forEach(log => modules.add(log.module));
    setUniqueModules(Array.from(modules).sort());
  }, [logs]);

  const filteredLogs = getFilteredLogs();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby="diagnostics-dialog-title"
    >
      <DialogTitle id="diagnostics-dialog-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <BugIcon sx={{ mr: 1 }} />
            <Typography variant="h6" component="div">
              診断パネル
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ color: theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="diagnostics tabs"
          >
            <Tab label="概要" icon={<InfoIcon />} iconPosition="start" {...a11yProps(0)} />
            <Tab label="ログ" icon={<BugIcon />} iconPosition="start" {...a11yProps(1)} />
            <Tab label="システム" icon={<StorageIcon />} iconPosition="start" {...a11yProps(2)} />
            <Tab label="パフォーマンス" icon={<SpeedIcon />} iconPosition="start" {...a11yProps(3)} />
            <Tab label="ネットワーク" icon={<NetworkIcon />} iconPosition="start" {...a11yProps(4)} />
            <Tab label="JSON 表示" icon={<CodeIcon />} iconPosition="start" {...a11yProps(5)} />
          </Tabs>
        </Box>
        
        <Box sx={{ px: 3 }}>
          {/* 概要タブ */}
          <TabPanel value={tabValue} index={0}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6">システム概要</Typography>
              <Button
                startIcon={isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outlined"
                size="small"
              >
                {isRefreshing ? '更新中...' : '更新'}
              </Button>
            </Box>
            
            {/* ステータスインジケーター */}
            <Stack direction="row" spacing={2} mb={3}>
              <Chip 
                label={isOnline ? 'オンライン' : 'オフライン'} 
                color={isOnline ? 'success' : 'error'} 
                variant="outlined" 
              />
              {summary.recentErrors > 0 && (
                <Chip 
                  icon={<ErrorIcon />}
                  label={`${summary.recentErrors} エラー`} 
                  color="error" 
                  variant="outlined" 
                />
              )}
              {summary.failedRequests > 0 && (
                <Chip 
                  icon={<WarningIcon />}
                  label={`${summary.failedRequests} 失敗リクエスト`} 
                  color="warning" 
                  variant="outlined" 
                />
              )}
              {summary.wsReconnects > 0 && (
                <Chip 
                  icon={<InfoIcon />}
                  label={`${summary.wsReconnects} WS 再接続`} 
                  color="info" 
                  variant="outlined" 
                />
              )}
            </Stack>
            
            <Grid container spacing={3}>
              {/* システム情報 */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>アプリケーション情報</Typography>
                  
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">バージョン</Typography>
                      <Typography variant="body2">{systemInfo?.appVersion || 'N/A'}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">ブラウザ</Typography>
                      <Typography variant="body2" sx={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {systemInfo?.userAgent.split(' ').slice(0, 3).join(' ') || 'N/A'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">プラットフォーム</Typography>
                      <Typography variant="body2">{systemInfo?.platform || 'N/A'}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">画面解像度</Typography>
                      <Typography variant="body2">{systemInfo?.screenResolution || 'N/A'}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">タイムゾーン</Typography>
                      <Typography variant="body2">{systemInfo?.timeZone || 'N/A'}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">ローカルストレージ</Typography>
                      <Typography variant="body2">{formatFileSize(systemInfo?.storageUsage?.localStorage)}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
              
              {/* パフォーマンス概要 */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>パフォーマンス概要</Typography>
                  
                  <Stack spacing={2}>
                    {summary.avgApiLatency !== null && (
                      <Box>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">平均 API レイテンシー</Typography>
                          <Typography variant="body2">{summary.avgApiLatency.toFixed(2)} ms</Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(100, (summary.avgApiLatency / 1000) * 100)} 
                          sx={{ mt: 1, height: 8, borderRadius: 4 }}
                          color={summary.avgApiLatency > 500 ? "warning" : "success"}
                        />
                      </Box>
                    )}
                    
                    <Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">長時間タスク (300ms+)</Typography>
                        <Typography variant="body2">{summary.longTasks} 件</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, (summary.longTasks / 10) * 100)} 
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        color={summary.longTasks > 5 ? "warning" : "success"}
                      />
                    </Box>
                    
                    <Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">失敗したリクエスト</Typography>
                        <Typography variant="body2">{summary.failedRequests} 件</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, (summary.failedRequests / 5) * 100)} 
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        color={summary.failedRequests > 0 ? "error" : "success"}
                      />
                    </Box>
                    
                    <Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">WebSocket 再接続</Typography>
                        <Typography variant="body2">{summary.wsReconnects} 回</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, (summary.wsReconnects / 3) * 100)} 
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        color={summary.wsReconnects > 1 ? "warning" : "success"}
                      />
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
              
              {/* 最近のエラー */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>最近のエラー・警告</Typography>
                  
                  {logs.filter(log => ['error', 'warn'].includes(log.level)).length === 0 ? (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      最近のエラーや警告はありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {logs
                        .filter(log => ['error', 'warn'].includes(log.level))
                        .slice(-5)
                        .reverse()
                        .map(log => {
                          const levelStyle = getLogLevelStyle(log.level);
                          return (
                            <ListItem key={log.id} divider>
                              <ListItemText
                                primary={
                                  <Box display="flex" alignItems="center">
                                    {levelStyle.icon}
                                    <Box component="span" ml={1} color={levelStyle.color}>
                                      {log.message}
                                    </Box>
                                  </Box>
                                }
                                secondary={
                                  <Box display="flex" justifyContent="space-between" mt={0.5}>
                                    <Typography variant="caption" component="span">
                                      {log.module}
                                    </Typography>
                                    <Typography variant="caption" component="span">
                                      {format(new Date(log.timestamp), 'yyyy/MM/dd HH:mm:ss')}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </ListItem>
                          );
                        })}
                    </List>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* ログタブ */}
          <TabPanel value={tabValue} index={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">アプリケーションログ</Typography>
              <Box>
                <Button
                  startIcon={<DeleteIcon />}
                  onClick={handleClearLogs}
                  color="error"
                  variant="outlined"
                  size="small"
                  sx={{ mr: 1 }}
                >
                  ログをクリア
                </Button>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  variant="outlined"
                  size="small"
                >
                  更新
                </Button>
              </Box>
            </Box>
            
            {/* フィルターコントロール */}
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    label="検索"
                    placeholder="メッセージ、モジュール、データなどを検索..."
                    fullWidth
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>モジュール</InputLabel>
                    <Select
                      value={moduleFilter}
                      label="モジュール"
                      onChange={handleModuleChange}
                    >
                      <MenuItem value="all">すべてのモジュール</MenuItem>
                      {uniqueModules.map(module => (
                        <MenuItem key={module} value={module}>{module}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label="エラー"
                      color="error"
                      variant={logFilter.includes('error') ? 'filled' : 'outlined'}
                      onClick={() => handleLogLevelChange('error')}
                      size="small"
                    />
                    <Chip
                      label="警告"
                      color="warning"
                      variant={logFilter.includes('warn') ? 'filled' : 'outlined'}
                      onClick={() => handleLogLevelChange('warn')}
                      size="small"
                    />
                    <Chip
                      label="情報"
                      color="info"
                      variant={logFilter.includes('info') ? 'filled' : 'outlined'}
                      onClick={() => handleLogLevelChange('info')}
                      size="small"
                    />
                    <Chip
                      label="デバッグ"
                      color="default"
                      variant={logFilter.includes('debug') ? 'filled' : 'outlined'}
                      onClick={() => handleLogLevelChange('debug')}
                      size="small"
                    />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
            
            {/* ログリスト */}
            <Paper variant="outlined" sx={{ mb: 2 }}>
              {filteredLogs.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    該当するログが見つかりません
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding sx={{ maxHeight: '500px', overflow: 'auto' }}>
                  {filteredLogs.slice().reverse().map(log => {
                    const isExpanded = expandedLogIds.has(log.id);
                    const levelStyle = getLogLevelStyle(log.level);
                    
                    return (
                      <ListItem 
                        key={log.id} 
                        divider 
                        secondaryAction={
                          <IconButton edge="end" onClick={() => toggleLogExpand(log.id)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center">
                              {levelStyle.icon}
                              <Box component="span" ml={1} fontWeight={log.level === 'error' ? 'medium' : 'regular'}>
                                {log.message}
                              </Box>
                            </Box>
                          }
                          secondary={
                            <>
                              <Box display="flex" justifyContent="space-between" mt={0.5}>
                                <Typography variant="caption" component="span" sx={{ mr: 2 }}>
                                  {log.module}
                                </Typography>
                                <Typography variant="caption" component="span">
                                  {format(new Date(log.timestamp), 'yyyy/MM/dd HH:mm:ss')}
                                </Typography>
                              </Box>
                              
                              {isExpanded && (
                                <Box mt={1}>
                                  {log.data && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" component="div" color="text.secondary">
                                        データ:
                                      </Typography>
                                      <Paper
                                        variant="outlined"
                                        sx={{
                                          p: 1,
                                          mt: 0.5,
                                          backgroundColor: theme.palette.background.default,
                                          maxHeight: '150px',
                                          overflow: 'auto',
                                        }}
                                      >
                                        <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                                          {JSON.stringify(log.data, null, 2)}
                                        </pre>
                                      </Paper>
                                    </Box>
                                  )}
                                  
                                  {log.stack && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" component="div" color="text.secondary">
                                        スタックトレース:
                                      </Typography>
                                      <Paper
                                        variant="outlined"
                                        sx={{
                                          p: 1,
                                          mt: 0.5,
                                          backgroundColor: theme.palette.background.default,
                                          maxHeight: '150px',
                                          overflow: 'auto',
                                        }}
                                      >
                                        <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                                          {log.stack}
                                        </pre>
                                      </Paper>
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Paper>
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                表示中: {filteredLogs.length} / {logs.length} 件のログ
              </Typography>
            </Box>
          </TabPanel>
          
          {/* システムタブ */}
          <TabPanel value={tabValue} index={2}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6">システム情報</Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                variant="outlined"
                size="small"
              >
                更新
              </Button>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>ブラウザと環境</Typography>
                  
                  <List dense disablePadding>
                    <ListItem divider>
                      <ListItemText primary="ユーザーエージェント" secondary={systemInfo?.userAgent || 'N/A'} />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText primary="プラットフォーム" secondary={systemInfo?.platform || 'N/A'} />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText primary="言語" secondary={systemInfo?.language || 'N/A'} />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText primary="画面解像度" secondary={systemInfo?.screenResolution || 'N/A'} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="タイムゾーン" secondary={systemInfo?.timeZone || 'N/A'} />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>メモリとストレージ</Typography>
                  
                  <List dense disablePadding>
                    <ListItem divider>
                      <ListItemText 
                        primary="LocalStorage 使用量" 
                        secondary={formatFileSize(systemInfo?.storageUsage?.localStorage)} 
                      />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText 
                        primary="SessionStorage 使用量" 
                        secondary={formatFileSize(systemInfo?.storageUsage?.sessionStorage)} 
                      />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText 
                        primary="IndexedDB 使用量 (推定)" 
                        secondary={formatFileSize(systemInfo?.storageUsage?.indexedDB)} 
                      />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText 
                        primary="JS ヒープ使用量" 
                        secondary={formatFileSize(systemInfo?.memoryUsage?.usedJSHeapSize)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="JS ヒープサイズ上限" 
                        secondary={formatFileSize(systemInfo?.memoryUsage?.jsHeapSizeLimit)} 
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1">アプリケーション情報</Typography>
                    <Chip 
                      label={`バージョン: ${systemInfo?.appVersion || 'N/A'}`} 
                      color="primary" 
                      variant="outlined" 
                      size="small" 
                    />
                  </Box>
                  
                  <Alert severity="info" sx={{ mb: 2 }}>
                    ブラウザの種類、バージョン、デバイス環境によって利用可能なメトリクスが異なる場合があります。
                    メモリ使用量はChrome/Edge/Operaでのみ利用可能です。
                  </Alert>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* パフォーマンスタブ */}
          <TabPanel value={tabValue} index={3}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6">パフォーマンスメトリクス</Typography>
              <Box>
                <Button
                  startIcon={<DeleteIcon />}
                  onClick={handleResetPerformanceMetrics}
                  color="error"
                  variant="outlined"
                  size="small"
                  sx={{ mr: 1 }}
                >
                  リセット
                </Button>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  variant="outlined"
                  size="small"
                >
                  更新
                </Button>
              </Box>
            </Box>
            
            <Grid container spacing={3}>
              {/* ページロード時間 */}
              <Grid item xs={12} lg={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    ページロード時間
                  </Typography>
                  
                  {Object.keys(performanceMetrics?.pageLoads || {}).length === 0 ? (
                    <Alert severity="info">
                      ページロード計測データがありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {Object.entries(performanceMetrics?.pageLoads || {}).map(([page, times]) => {
                        const avgTime = times.reduce((acc, t) => acc + t, 0) / times.length;
                        
                        return (
                          <ListItem key={page} divider>
                            <ListItemText
                              primary={page}
                              secondary={
                                <>
                                  <Box display="flex" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      平均: {avgTime.toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      最大: {Math.max(...times).toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      データ数: {times.length}
                                    </Typography>
                                  </Box>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(100, (avgTime / 3000) * 100)}
                                    color={avgTime > 1000 ? "warning" : "success"}
                                    sx={{ mt: 1, height: 6 }}
                                  />
                                </>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Paper>
              </Grid>
              
              {/* API呼び出し時間 */}
              <Grid item xs={12} lg={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    API リクエスト時間
                  </Typography>
                  
                  {Object.keys(performanceMetrics?.apiCalls || {}).length === 0 ? (
                    <Alert severity="info">
                      API呼び出し計測データがありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {Object.entries(performanceMetrics?.apiCalls || {}).map(([endpoint, times]) => {
                        const avgTime = times.reduce((acc, t) => acc + t, 0) / times.length;
                        
                        return (
                          <ListItem key={endpoint} divider>
                            <ListItemText
                              primary={endpoint}
                              secondary={
                                <>
                                  <Box display="flex" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      平均: {avgTime.toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      最大: {Math.max(...times).toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      呼び出し数: {times.length}
                                    </Typography>
                                  </Box>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(100, (avgTime / 1000) * 100)}
                                    color={avgTime > 500 ? "warning" : "success"}
                                    sx={{ mt: 1, height: 6 }}
                                  />
                                </>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Paper>
              </Grid>
              
              {/* 長時間タスク */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    長時間タスク (300ms以上)
                  </Typography>
                  
                  {(performanceMetrics?.longTasks || []).length === 0 ? (
                    <Alert severity="success">
                      検出された長時間タスクはありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {performanceMetrics?.longTasks.slice(0, 10).map((task, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                <Typography variant="body2">
                                  {task.name || 'Unknown task'}
                                </Typography>
                                <Chip
                                  label={`${task.duration.toFixed(2)} ms`}
                                  color={task.duration > 500 ? "error" : "warning"}
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(performance.timeOrigin + task.startTime), 'HH:mm:ss.SSS')}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                      
                      {(performanceMetrics?.longTasks || []).length > 10 && (
                        <ListItem>
                          <ListItemText
                            primary={
                              <Typography variant="body2" color="text.secondary" align="center">
                                他 {(performanceMetrics?.longTasks.length || 0) - 10} 件...
                              </Typography>
                            }
                          />
                        </ListItem>
                      )}
                    </List>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* ネットワークタブ */}
          <TabPanel value={tabValue} index={4}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6">ネットワーク診断</Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                variant="outlined"
                size="small"
              >
                更新
              </Button>
            </Box>
            
            <Grid container spacing={3}>
              {/* API レイテンシー */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    API レイテンシー
                  </Typography>
                  
                  {Object.keys(networkDiagnostics?.apiLatency || {}).length === 0 ? (
                    <Alert severity="info">
                      APIレイテンシーデータがありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {Object.entries(networkDiagnostics?.apiLatency || {}).map(([endpoint, latencies]) => {
                        const avgLatency = latencies.reduce((acc, l) => acc + l, 0) / latencies.length;
                        
                        return (
                          <ListItem key={endpoint} divider>
                            <ListItemText
                              primary={endpoint}
                              secondary={
                                <>
                                  <Box display="flex" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      平均: {avgLatency.toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      最大: {Math.max(...latencies).toFixed(2)} ms
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      呼び出し数: {latencies.length}
                                    </Typography>
                                  </Box>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(100, (avgLatency / 1000) * 100)}
                                    color={avgLatency > 500 ? "warning" : "success"}
                                    sx={{ mt: 1, height: 6 }}
                                  />
                                </>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Paper>
              </Grid>
              
              {/* 失敗したリクエスト */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    失敗したリクエスト
                  </Typography>
                  
                  {(networkDiagnostics?.failedRequests || []).length === 0 ? (
                    <Alert severity="success">
                      失敗したリクエストはありません
                    </Alert>
                  ) : (
                    <List dense disablePadding>
                      {networkDiagnostics?.failedRequests.map((request, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                <Chip 
                                  label={request.method} 
                                  size="small" 
                                  sx={{ mr: 1, minWidth: 45 }} 
                                />
                                <Typography variant="body2">
                                  {request.url}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box display="flex" justifyContent="space-between" mt={0.5}>
                                <Chip 
                                  label={request.status || 'NETWORK ERROR'} 
                                  color="error" 
                                  size="small" 
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(request.timestamp), 'yyyy/MM/dd HH:mm:ss')}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Paper>
              </Grid>
              
              {/* WS接続情報 */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1">WebSocket 接続情報</Typography>
                    <Chip 
                      label={isOnline ? 'オンライン' : 'オフライン'} 
                      color={isOnline ? 'success' : 'error'} 
                      size="small" 
                    />
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>再接続回数</Typography>
                        <Typography variant="h5">{networkDiagnostics?.wsReconnects || 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>最終ネットワーク変更</Typography>
                        <Typography variant="h6">
                          {networkDiagnostics?.lastNetworkChangeTime 
                            ? format(new Date(networkDiagnostics.lastNetworkChangeTime), 'HH:mm:ss')
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* JSON表示タブ */}
          <TabPanel value={tabValue} index={5}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6">診断情報JSON</Typography>
              <Button
                startIcon={isDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleExportDiagnostics}
                variant="contained"
                disabled={isDownloading}
              >
                {isDownloading ? 'エクスポート中...' : '診断情報をエクスポート'}
              </Button>
            </Box>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              この画面では診断情報をJSON形式で確認できます。問題の報告時にこのデータをエクスポートすると、
              開発者が問題解決に役立つ詳細情報を得ることができます。
            </Alert>
            
            <Paper 
              variant="outlined"
              sx={{
                p: 2,
                maxHeight: '500px',
                overflow: 'auto',
                backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
              }}
            >
              <pre style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>
                {JSON.stringify(
                  {
                    systemInfo,
                    logs: logs.slice(-10),
                    networkDiagnostics,
                    performanceMetrics
                  }, 
                  null, 2
                )}
              </pre>
            </Paper>
          </TabPanel>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleExportDiagnostics} startIcon={<DownloadIcon />}>
          診断情報をエクスポート
        </Button>
        <Button onClick={onClose} color="primary">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiagnosticsPanel;