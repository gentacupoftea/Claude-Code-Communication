/**
 * デバッグ機能のデモページ
 * 各種デバッグ機能をテストするためのページ
 */
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box,
  Button,
  Grid,
  Paper,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardActions,
  Alert,
  LinearProgress
} from '@mui/material';
import { mainLayout } from '../../layouts/MainLayout';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { DiagnosticsPanel } from '../../components/debug';
import diagnosticsService from '../../services/diagnosticsService';

// 意図的にエラーを発生させる関数
const causeError = () => {
  // オブジェクトが未定義であることによるエラーを発生させる
  const obj: any = undefined;
  return obj.nonExistentProperty;
};

// 意図的に重い処理を行う関数
const heavyOperation = (iterations: number = 10000000) => {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }
  return result;
};

// レンダリングを無駄に多く行うコンポーネント
const IneffectiveComponent: React.FC = () => {
  const [counter, setCounter] = useState(0);
  
  // 無駄なレンダリングを発生させる
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCounter(prev => prev + 1);
    }, 100);
    
    return () => clearInterval(intervalId);
  }, []);
  
  return (
    <div>カウント: {counter}</div>
  );
};

export const DebugDemoComponent: React.FC = () => {
  const [message, setMessage] = useState('');
  const [logLevel, setLogLevel] = useState<'debug' | 'info' | 'warn' | 'error'>('info');
  const [isHeavyOperationRunning, setIsHeavyOperationRunning] = useState(false);
  const [isIneffectiveRendering, setIsIneffectiveRendering] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mockApiLatency, setMockApiLatency] = useState(500);
  const [mockApiFailRate, setMockApiFailRate] = useState(0);
  
  const { 
    logDebug, 
    logInfo, 
    logWarning, 
    logError,
    summary
  } = useDiagnostics();
  
  const { 
    trackRenderStart, 
    trackRenderEnd, 
    measureOperation: measureComponentOperation 
  } = usePerformanceMonitor({
    componentName: 'DebugDemoPage',
    trackMounts: true,
    trackUpdates: true
  });
  
  // ページレンダリングのパフォーマンス計測
  useEffect(() => {
    trackRenderStart();
    
    return () => {
      trackRenderEnd();
    };
  });
  
  // テストログの送信
  const sendTestLog = () => {
    if (!message.trim()) return;
    
    switch (logLevel) {
      case 'debug':
        logDebug('debug-demo', message);
        break;
      case 'info':
        logInfo('debug-demo', message);
        break;
      case 'warn':
        logWarning('debug-demo', message);
        break;
      case 'error':
        logError('debug-demo', message);
        break;
    }
    
    setMessage('');
  };
  
  // 重い処理の実行
  const runHeavyOperation = () => {
    setIsHeavyOperationRunning(true);
    
    // 処理の開始を計測
    const endMeasure = measureComponentOperation('heavy-operation');
    
    // 非同期で重い処理を実行
    setTimeout(() => {
      const result = heavyOperation();
      
      // 処理の終了を計測
      const duration = endMeasure();
      
      logInfo('performance', `重い処理が完了しました: ${duration.toFixed(2)}ms`, { result });
      setIsHeavyOperationRunning(false);
    }, 100);
  };
  
  // 擬似的なAPI呼び出し
  const mockApiCall = async (endpoint: string, shouldFail: boolean = false) => {
    const startTime = performance.now();
    
    try {
      // APIレイテンシーをシミュレート
      await new Promise(resolve => setTimeout(resolve, mockApiLatency));
      
      // ランダムな失敗をシミュレート
      if (shouldFail || Math.random() < mockApiFailRate / 100) {
        throw new Error('API call failed');
      }
      
      // 成功した場合の処理
      const endTime = performance.now();
      diagnosticsService.recordApiLatency(endpoint, endTime - startTime);
      
      return { success: true, data: { message: 'API call succeeded' } };
    } catch (error) {
      // 失敗した場合の処理
      diagnosticsService.recordFailedRequest(
        endpoint,
        'GET',
        500,
        error instanceof Error ? error.message : String(error)
      );
      
      throw error;
    }
  };
  
  // 成功する擬似的なAPI呼び出し
  const callSuccessfulApi = async () => {
    try {
      await mockApiCall('/api/success', false);
      logInfo('api', 'API call succeeded');
    } catch (error) {
      logError('api', 'API call failed', { error });
    }
  };
  
  // 失敗する擬似的なAPI呼び出し
  const callFailingApi = async () => {
    try {
      await mockApiCall('/api/fail', true);
    } catch (error) {
      logError('api', 'API call failed', { error });
    }
  };
  
  // WebSocket再接続のシミュレーション
  const simulateWsReconnect = () => {
    diagnosticsService.recordWsReconnect();
    logWarning('websocket', 'WebSocket connection lost, attempting to reconnect');
  };
  
  // 診断パネルを開く
  const openDiagnosticsPanel = () => {
    setIsPanelOpen(true);
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          デバッグ機能デモ
        </Typography>
        <Typography color="text.secondary">
          デバッグとパフォーマンス計測のための各種機能をテストできます
        </Typography>
      </Box>
      
      {/* サマリー情報 */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>診断情報サマリー</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  エラー数
                </Typography>
                <Typography variant="h4" color="error">
                  {summary.recentErrors}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  失敗リクエスト
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.failedRequests}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  平均レイテンシー
                </Typography>
                <Typography variant="h4">
                  {summary.avgApiLatency !== null ? `${summary.avgApiLatency.toFixed(1)}ms` : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  WS再接続
                </Typography>
                <Typography variant="h4">
                  {summary.wsReconnects}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={openDiagnosticsPanel}
          >
            詳細な診断情報を表示
          </Button>
        </Box>
      </Paper>
      
      {/* テスト機能グリッド */}
      <Grid container spacing={4}>
        {/* ログ送信テスト */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              ログテスト
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ログメッセージ"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>ログレベル</InputLabel>
                  <Select
                    value={logLevel}
                    label="ログレベル"
                    onChange={(e) => setLogLevel(e.target.value as any)}
                  >
                    <MenuItem value="debug">Debug</MenuItem>
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="warn">Warning</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={sendTestLog}
                disabled={!message.trim()}
              >
                ログを送信
              </Button>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              エラーテスト
            </Typography>
            
            <Button 
              variant="outlined" 
              color="error" 
              onClick={() => {
                try {
                  causeError();
                } catch (error) {
                  logError('debug-demo', '意図的に発生させたエラー', { error });
                }
              }}
              sx={{ mr: 2 }}
            >
              エラーを発生させる
            </Button>
            
            <Button 
              variant="outlined" 
              color="warning" 
              onClick={() => {
                throw new Error('意図的に未捕捉のエラーを発生させました');
              }}
            >
              未捕捉のエラーを発生させる
            </Button>
          </Paper>
        </Grid>
        
        {/* パフォーマンステスト */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              パフォーマンステスト
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Alert severity="info" sx={{ mb: 2 }}>
              以下の操作により、パフォーマンス問題をシミュレートできます。
            </Alert>
            
            <Typography variant="body2" gutterBottom>
              重い処理のシミュレーション:
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Button 
                variant="contained" 
                onClick={runHeavyOperation}
                disabled={isHeavyOperationRunning}
                color="warning"
              >
                重い処理を実行
              </Button>
              
              {isHeavyOperationRunning && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                    処理中...
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Typography variant="body2" gutterBottom>
              非効率なレンダリング:
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isIneffectiveRendering}
                    onChange={(e) => setIsIneffectiveRendering(e.target.checked)}
                  />
                }
                label="頻繁なレンダリングを発生させる"
              />
              
              {isIneffectiveRendering && (
                <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <IneffectiveComponent />
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* ネットワークテスト */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              ネットワークテスト
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" gutterBottom>
              APIシミュレーション設定:
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="モックレイテンシー (ms)"
                  type="number"
                  value={mockApiLatency}
                  onChange={(e) => setMockApiLatency(Number(e.target.value))}
                  inputProps={{ min: 0, max: 10000 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="失敗率 (%)"
                  type="number"
                  value={mockApiFailRate}
                  onChange={(e) => setMockApiFailRate(Number(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
            </Grid>
            
            <Typography variant="body2" gutterBottom>
              API呼び出しテスト:
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Button 
                variant="contained" 
                color="success" 
                onClick={callSuccessfulApi}
                sx={{ mr: 2 }}
              >
                成功するAPI呼び出し
              </Button>
              
              <Button 
                variant="contained" 
                color="error" 
                onClick={callFailingApi}
              >
                失敗するAPI呼び出し
              </Button>
            </Box>
            
            <Typography variant="body2" gutterBottom>
              WebSocketテスト:
            </Typography>
            <Box>
              <Button 
                variant="outlined" 
                color="warning" 
                onClick={simulateWsReconnect}
              >
                WebSocket再接続をシミュレート
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* エラーバウンダリーテスト */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              エラーバウンダリーテスト
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              以下のボタンを押すと、エラーバウンダリーによってキャッチされるエラーが発生します。
              アプリケーション全体ではなく、このコンポーネントだけがエラー表示に置き換わります。
            </Alert>
            
            <Button 
              variant="contained" 
              color="error" 
              onClick={() => {
                throw new Error('エラーバウンダリーテスト用のエラー');
              }}
            >
              エラーバウンダリーをテスト
            </Button>
          </Paper>
        </Grid>
      </Grid>
      
      {/* 診断パネル */}
      <DiagnosticsPanel
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </Container>
  );
};

export const DebugDemoPage = mainLayout(DebugDemoComponent);