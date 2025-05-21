/**
 * エラーバウンダリーコンポーネント
 * コンポーネントツリー内のエラーをキャプチャし、フォールバックUIを表示する
 */
import React, { Component, ErrorInfo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  AlertTitle,
  Divider,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import diagnosticsService from '../../services/diagnosticsService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnRoutingChange?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラー情報を診断サービスに記録
    const componentName = this.props.componentName || 'unknown';
    
    diagnosticsService.log('error', 'react', `Error in component: ${componentName}`, {
      error,
      componentStack: errorInfo.componentStack,
      component: componentName,
    });
    
    this.setState({
      errorInfo
    });
    
    // カスタムエラーハンドラーがあれば呼び出す
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // ルーティング変更時にエラー状態をリセット
    if (
      this.props.resetOnRoutingChange &&
      this.state.hasError &&
      this.props.children !== prevProps.children
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  toggleDetails = (): void => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  navigateToHome = (): void => {
    window.location.href = '/';
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback, componentName } = this.props;

    if (hasError) {
      // カスタムフォールバックがあればそれを使用
      if (fallback) {
        return fallback;
      }

      // デフォルトのエラー表示
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '300px',
            padding: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 3,
              width: '100%',
              maxWidth: 600,
              borderRadius: 2
            }}
          >
            <Alert
              severity="error"
              variant="filled"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={this.resetErrorBoundary}
                  startIcon={<RefreshIcon />}
                >
                  再試行
                </Button>
              }
            >
              <AlertTitle>エラーが発生しました</AlertTitle>
              {componentName ? `コンポーネント「${componentName}」でエラーが発生しました。` : '予期しないエラーが発生しました。'}
            </Alert>

            <Typography variant="body1" gutterBottom>
              {error?.message || 'アプリケーションでエラーが発生しました。'}
            </Typography>

            <Box sx={{ mt: 2, mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={this.resetErrorBoundary}
                startIcon={<RefreshIcon />}
                sx={{ mr: 1 }}
              >
                再読み込み
              </Button>
              <Button
                variant="outlined"
                onClick={this.navigateToHome}
                startIcon={<HomeIcon />}
              >
                ホームに戻る
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                エラーの詳細情報
              </Typography>
              <IconButton size="small" onClick={this.toggleDetails}>
                {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={showDetails}>
              <Paper
                variant="outlined"
                sx={{ mt: 2, p: 2, bgcolor: 'background.default', maxHeight: 300, overflow: 'auto' }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  エラーメッセージ:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 2 }}>
                  {error?.toString()}
                </Typography>

                {errorInfo && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      コンポーネントスタック:
                    </Typography>
                    <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}

                {error?.stack && (
                  <>
                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                      スタックトレース:
                    </Typography>
                    <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {error.stack}
                    </pre>
                  </>
                )}
              </Paper>
            </Collapse>
          </Paper>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
            <BugIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            このエラーは自動的に記録されました
          </Typography>
        </Box>
      );
    }

    return children;
  }
}

export default ErrorBoundary;