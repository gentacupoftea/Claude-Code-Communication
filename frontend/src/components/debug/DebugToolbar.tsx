/**
 * デバッグツールバーコンポーネント
 * 開発者向けのデバッグツールバーを提供
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
  Divider,
  Chip,
  Typography,
  IconButton,
  Paper,
  Slide,
  Fab,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Grid,
  SelectChangeEvent,
} from '@mui/material';
import {
  BugReport as BugIcon,
  Storage as StorageIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Clear as ClearIcon,
  NetworkCheck as NetworkIcon,
  Speed as SpeedIcon,
  Save as SaveIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  QueryStats as StatsIcon,
} from '@mui/icons-material';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { DiagnosticsPanel } from './DiagnosticsPanel';

interface DebugToolbarProps {
  position?: 'top' | 'bottom';
  isDevelopment?: boolean;
}

export const DebugToolbar: React.FC<DebugToolbarProps> = ({
  position = 'bottom',
  isDevelopment = process.env.NODE_ENV === 'development'
}) => {
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logTestDialogOpen, setLogTestDialogOpen] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const [logModule, setLogModule] = useState('test');
  const [logLevel, setLogLevel] = useState<'debug' | 'info' | 'warn' | 'error'>('debug');
  const [logData, setLogData] = useState('{}');
  const [mockNetworkDialogOpen, setMockNetworkDialogOpen] = useState(false);
  const [mockNetworkLatency, setMockNetworkLatency] = useState(500);
  const [mockNetworkFailRate, setMockNetworkFailRate] = useState(0);
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false);
  const [minified, setMinified] = useState(false);
  
  const {
    logs,
    summary,
    isOnline,
    logError,
    logWarning,
    logInfo,
    logDebug,
    clearLogs,
    refreshAllDiagnostics
  } = useDiagnostics();

  // メニューの開閉
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // ツールバーの展開/折りたたみ
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // 最小化/最大化の切り替え
  const toggleMinified = () => {
    setMinified(!minified);
  };

  // 診断パネルを開く
  const openDiagnosticsPanel = () => {
    setDiagnosticsPanelOpen(true);
    handleClose();
  };

  // ログテストダイアログを開く
  const openLogTestDialog = () => {
    setLogTestDialogOpen(true);
    handleClose();
  };

  // ネットワーク設定ダイアログを開く
  const openMockNetworkDialog = () => {
    setMockNetworkDialogOpen(true);
    handleClose();
  };

  // ログをクリア
  const handleClearLogs = () => {
    clearLogs();
    handleClose();
  };

  // 診断情報を更新
  const handleRefresh = () => {
    refreshAllDiagnostics();
    handleClose();
  };

  // ローカルストレージをクリア
  const handleClearLocalStorage = () => {
    try {
      localStorage.clear();
      logInfo('debug', 'Local storage cleared');
    } catch (e) {
      logError('debug', 'Failed to clear local storage', { error: e });
    }
    handleClose();
  };

  // ログレベルの変更
  const handleLogLevelChange = (event: SelectChangeEvent) => {
    setLogLevel(event.target.value as 'debug' | 'info' | 'warn' | 'error');
  };

  // テストログの送信
  const handleSendTestLog = () => {
    try {
      const parsedData = logData.trim() ? JSON.parse(logData) : undefined;
      
      switch (logLevel) {
        case 'debug':
          logDebug(logModule, logMessage, parsedData);
          break;
        case 'info':
          logInfo(logModule, logMessage, parsedData);
          break;
        case 'warn':
          logWarning(logModule, logMessage, parsedData);
          break;
        case 'error':
          logError(logModule, logMessage, parsedData);
          break;
      }
      
      setLogTestDialogOpen(false);
    } catch (e) {
      // JSONパースエラー
      logError('debug', 'Invalid JSON in test log data', { error: e });
    }
  };

  // モックネットワーク設定の適用
  const handleApplyMockNetwork = () => {
    // Fetchのモック設定（これは開発環境のみで実行されるべき）
    if (isDevelopment) {
      logInfo('debug', 'Applied mock network settings', { 
        latency: mockNetworkLatency, 
        failRate: mockNetworkFailRate 
      });
      
      setMockNetworkDialogOpen(false);
    }
  };

  // 最近のエラー件数に基づいて表示する
  const getErrorBadgeCount = () => {
    return summary.recentErrors || 0;
  };

  // 最近のエラーログを取得
  const getRecentErrorLogs = () => {
    return logs
      .filter(log => log.level === 'error')
      .slice(-3)
      .reverse();
  };

  // 開発環境でのみ表示
  if (!isDevelopment) return null;

  return (
    <>
      {/* ツールバー本体 */}
      <Slide direction="up" in={true} mountOnEnter unmountOnExit>
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            [position]: 0,
            zIndex: 1300,
            borderTopLeftRadius: position === 'bottom' ? 8 : 0,
            borderTopRightRadius: position === 'bottom' ? 8 : 0,
            borderBottomLeftRadius: position === 'top' ? 8 : 0,
            borderBottomRightRadius: position === 'top' ? 8 : 0,
            overflow: 'hidden',
            width: minified ? 'auto' : 'min(800px, 95%)',
            transition: 'width 0.3s ease',
          }}
        >
          {minified ? (
            // 最小化表示
            <Box sx={{ display: 'flex', p: 1, alignItems: 'center', gap: 1 }}>
              <Tooltip title="デバッグパネルを展開">
                <IconButton color="primary" onClick={toggleMinified}>
                  <Badge badgeContent={getErrorBadgeCount()} color="error">
                    <BugIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            // 通常表示
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  px: 2,
                  justifyContent: 'space-between',
                  bgcolor: 'background.default',
                  borderBottom: theme => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <BugIcon color="action" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2">
                    デバッグツール
                  </Typography>
                  <Chip
                    label={process.env.NODE_ENV}
                    color="default"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>
                
                <Box>
                  <Tooltip title="最小化">
                    <IconButton size="small" onClick={toggleMinified}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={expanded ? "折りたたむ" : "展開する"}>
                    <IconButton size="small" onClick={toggleExpanded}>
                      {expanded ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* ツールバーメイン部分 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    startIcon={<StatsIcon />}
                    onClick={openDiagnosticsPanel}
                    variant="outlined"
                    size="small"
                  >
                    診断パネル
                  </Button>
                  
                  <Tooltip title="デバッグメニュー">
                    <Button
                      startIcon={<BugIcon />}
                      onClick={handleClick}
                      size="small"
                      endIcon={<ExpandMoreIcon />}
                    >
                      ツール
                    </Button>
                  </Tooltip>
                  
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                  >
                    <MenuItem onClick={openLogTestDialog}>
                      <ListItemIcon>
                        <InfoIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>テストログ送信</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={openMockNetworkDialog}>
                      <ListItemIcon>
                        <NetworkIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>ネットワーク設定</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleClearLogs}>
                      <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>ログをクリア</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleClearLocalStorage}>
                      <ListItemIcon>
                        <StorageIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>LocalStorageクリア</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleRefresh}>
                      <ListItemIcon>
                        <RefreshIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>診断情報を更新</ListItemText>
                    </MenuItem>
                  </Menu>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={isOnline ? 'オンライン' : 'オフライン'}
                    color={isOnline ? 'success' : 'error'}
                    size="small"
                  />
                  
                  <Tooltip title="エラー数">
                    <Badge badgeContent={getErrorBadgeCount()} color="error">
                      <ErrorIcon color="action" />
                    </Badge>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* 展開時のみ表示される領域 */}
              {expanded && (
                <Box sx={{ p: 2, bgcolor: 'background.default', maxHeight: 300, overflow: 'auto' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    最近のエラー
                  </Typography>
                  
                  {getRecentErrorLogs().length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      エラーはありません
                    </Typography>
                  ) : (
                    getRecentErrorLogs().map(log => (
                      <Paper
                        key={log.id}
                        variant="outlined"
                        sx={{ p: 1, mb: 1, bgcolor: 'background.paper' }}
                      >
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="error">
                            {log.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          モジュール: {log.module}
                        </Typography>
                        {log.stack && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1, maxHeight: 100, overflow: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.7rem' }}>{log.stack}</pre>
                          </Box>
                        )}
                      </Paper>
                    ))
                  )}
                </Box>
              )}
            </>
          )}
        </Paper>
      </Slide>
      
      {/* フローティングアクションボタン */}
      <Tooltip title="診断パネルを開く">
        <Fab
          color="primary"
          size="small"
          sx={{
            position: 'fixed',
            right: 16,
            bottom: expanded ? 110 : (minified ? 64 : 70),
            zIndex: 1300,
          }}
          onClick={openDiagnosticsPanel}
        >
          <Badge badgeContent={getErrorBadgeCount()} color="error">
            <BugIcon />
          </Badge>
        </Fab>
      </Tooltip>
      
      {/* 診断パネル */}
      <DiagnosticsPanel
        open={diagnosticsPanelOpen}
        onClose={() => setDiagnosticsPanelOpen(false)}
      />
      
      {/* ログテストダイアログ */}
      <Dialog
        open={logTestDialogOpen}
        onClose={() => setLogTestDialogOpen(false)}
      >
        <DialogTitle>テストログ送信</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={8}>
              <TextField
                label="メッセージ"
                value={logMessage}
                onChange={(e) => setLogMessage(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="モジュール"
                value={logModule}
                onChange={(e) => setLogModule(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>ログレベル</InputLabel>
                <Select
                  value={logLevel}
                  label="ログレベル"
                  onChange={handleLogLevelChange}
                >
                  <MenuItem value="debug">Debug</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="データ (JSON)"
                value={logData}
                onChange={(e) => setLogData(e.target.value)}
                fullWidth
                multiline
                rows={4}
                placeholder="{}"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogTestDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSendTestLog}
            color="primary"
            variant="contained"
          >
            ログ送信
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* ネットワークモックダイアログ */}
      <Dialog
        open={mockNetworkDialogOpen}
        onClose={() => setMockNetworkDialogOpen(false)}
      >
        <DialogTitle>ネットワーク設定</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="モックレイテンシー (ms)"
                type="number"
                value={mockNetworkLatency}
                onChange={(e) => setMockNetworkLatency(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 0, max: 10000 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="エラー率 (%)"
                type="number"
                value={mockNetworkFailRate}
                onChange={(e) => setMockNetworkFailRate(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch />}
                label="オフラインモードをシミュレート"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMockNetworkDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleApplyMockNetwork}
            color="primary"
            variant="contained"
          >
            適用
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DebugToolbar;