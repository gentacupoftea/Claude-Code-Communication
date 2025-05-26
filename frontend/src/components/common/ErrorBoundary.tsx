import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Refresh as RefreshIcon, BugReport as BugReportIcon } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  public state: State = {
    hasError: false,
    errorId: '',
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: uuidv4().substr(0, 8)
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorDetails = {
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount
    };

    // 詳細ログ記録
    console.group(`🚨 React Error Boundary [${this.state.errorId}]`);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Details:', errorDetails);
    console.groupEnd();

    // エラー報告APIへ送信
    this.reportError(errorDetails);

    // プロップスコールバック実行
    this.props.onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  private async reportError(errorDetails: any) {
    try {
      await fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails)
      });
    } catch (reportingError) {
      console.warn('Error reporting failed:', reportingError);
    }
  }

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // 指数バックオフ遅延
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
    
    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: newRetryCount
      });
    }, delay);
    
    this.retryTimeouts.push(timeout);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public componentWillUnmount() {
    // クリーンアップ
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  public render() {
    if (this.state.hasError) {
      // カスタムフォールバックがある場合
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isPageLevel = this.props.level === 'page';
      const maxRetries = 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={isPageLevel ? "100vh" : "200px"}
          p={2}
          sx={{
            background: isPageLevel ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: isPageLevel ? 'white' : 'inherit'
          }}
        >
          <BugReportIcon 
            sx={{ 
              fontSize: isPageLevel ? 64 : 32, 
              mb: 2, 
              opacity: 0.7 
            }} 
          />
          
          <Typography 
            variant={isPageLevel ? "h4" : "h6"} 
            gutterBottom 
            textAlign="center"
          >
            申し訳ございません。エラーが発生しました。
          </Typography>
          
          <Typography 
            variant="body1" 
            color={isPageLevel ? "rgba(255,255,255,0.8)" : "textSecondary"} 
            sx={{ mb: 3, textAlign: 'center', maxWidth: 500 }}
          >
            予期しないエラーが発生しました。問題が解決しない場合は、サポートまでご連絡ください。
          </Typography>

          <Alert 
            severity="error" 
            sx={{ mb: 3, maxWidth: 500 }}
          >
            エラーID: {this.state.errorId}
            {this.state.retryCount > 0 && (
              <><br />リトライ回数: {this.state.retryCount}/{maxRetries}</>
            )}
          </Alert>

          <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
            {canRetry && (
              <Button
                variant="contained"
                onClick={this.handleRetry}
                startIcon={<RefreshIcon />}
                color="primary"
              >
                再試行 ({maxRetries - this.state.retryCount}回)
              </Button>
            )}
            
            <Button
              variant={canRetry ? "outlined" : "contained"}
              onClick={this.handleReload}
              startIcon={<RefreshIcon />}
              color="primary"
            >
              ページを再読み込み
            </Button>
          </Box>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Accordion sx={{ mt: 3, maxWidth: 800, width: '100%' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>エラー詳細 (開発環境)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box component="pre" sx={{ 
                  overflow: 'auto', 
                  fontSize: '12px',
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  p: 2,
                  borderRadius: 1
                }}>
                  <strong>Error:</strong> {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      <br /><br />
                      <strong>Stack Trace:</strong>
                      <br />
                      {this.state.error.stack}
                    </>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      <br />
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;