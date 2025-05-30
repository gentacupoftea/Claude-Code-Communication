import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Container,
  Link,
  Fade,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Share as ShareIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { WidgetRenderer } from '../../features/dashboard/components/WidgetRenderer';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface PublicDashboardData {
  id: string;
  name: string;
  description?: string;
  config: {
    widgets: any[];
    layout: any;
    settings?: any;
  };
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  is_password_protected?: boolean;
}

export const PublicDashboard: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [searchParams] = useSearchParams();
  
  const [dashboard, setDashboard] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [layouts, setLayouts] = useState<any>({});

  // URLパラメータからパスワードを取得
  const urlPassword = searchParams.get('password');

  useEffect(() => {
    if (shareToken) {
      fetchPublicDashboard();
    }
  }, [shareToken]);

  useEffect(() => {
    // URLにパスワードが含まれている場合は自動的に認証を試行
    if (urlPassword && passwordRequired) {
      setPassword(urlPassword);
      handlePasswordSubmit(urlPassword);
    }
  }, [urlPassword, passwordRequired]);

  const fetchPublicDashboard = async (dashboardPassword?: string) => {
    try {
      setLoading(true);
      setError(null);

      const requestBody = dashboardPassword ? { password: dashboardPassword } : {};
      const response = await fetch(`/api/v2/dashboards/public/${shareToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        ...(dashboardPassword && {
          method: 'POST',
          body: JSON.stringify(requestBody)
        })
      });

      if (response.status === 401) {
        setPasswordRequired(true);
        return;
      }

      if (!response.ok) {
        throw new Error('ダッシュボードの取得に失敗しました');
      }

      const data = await response.json();
      setDashboard(data);
      setPasswordRequired(false);
      
      // レイアウトを設定
      if (data.config?.layout) {
        setLayouts(data.config.layout);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (passwordValue?: string) => {
    const passwordToUse = passwordValue || password;
    if (!passwordToUse.trim()) {
      setPasswordError('パスワードを入力してください');
      return;
    }

    setPasswordError('');
    await fetchPublicDashboard(passwordToUse);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // 全画面モードの状態変化を監視
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleShare = () => {
    const currentUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: dashboard?.name || 'Coneaダッシュボード',
        text: dashboard?.description || '',
        url: currentUrl,
      });
    } else {
      navigator.clipboard.writeText(currentUrl);
      // TODO: スナックバーで成功メッセージ表示
    }
  };

  const handleLayoutChange = (layout: Layout[], layouts: any) => {
    // 公開ダッシュボードでは読み取り専用のため、レイアウト変更は無効
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          ダッシュボードを読み込んでいます...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box py={8} textAlign="center">
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Typography variant="h6" gutterBottom>
            ダッシュボードが見つかりません
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            リンクが正しいか確認するか、ダッシュボードの作成者にお問い合わせください。
          </Typography>
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            href="/"
          >
            ホームに戻る
          </Button>
        </Box>
      </Container>
    );
  }

  // パスワード入力ダイアログ
  if (passwordRequired) {
    return (
      <Dialog
        open={true}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <LockIcon />
            <Typography variant="h6">
              パスワードが必要です
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3}>
            このダッシュボードはパスワードで保護されています。
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
            onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
          />
        </DialogContent>
        <DialogActions>
          <Button href="/">キャンセル</Button>
          <Button 
            variant="contained" 
            onClick={() => handlePasswordSubmit()}
            disabled={!password.trim()}
          >
            アクセス
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <Fade in={true} timeout={500}>
      <Box>
        {/* ヘッダー */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{ 
            backgroundColor: 'primary.main',
            display: isFullscreen ? 'none' : 'block'
          }}
        >
          <Toolbar>
            <Box display="flex" alignItems="center" gap={2} flexGrow={1}>
              <Typography variant="h6" component="div">
                {dashboard.name}
              </Typography>
              
              {dashboard.tags && dashboard.tags.length > 0 && (
                <Box display="flex" gap={0.5}>
                  {dashboard.tags.slice(0, 3).map((tag) => (
                    <Chip 
                      key={tag} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                      sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
                <VisibilityIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                {dashboard.access_count} 回表示
              </Typography>

              <IconButton
                color="inherit"
                onClick={handleShare}
                title="共有"
              >
                <ShareIcon />
              </IconButton>

              <IconButton
                color="inherit"
                onClick={toggleFullscreen}
                title={isFullscreen ? '全画面を終了' : '全画面表示'}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* ダッシュボード説明（全画面時は非表示） */}
        {dashboard.description && !isFullscreen && (
          <Box sx={{ backgroundColor: 'grey.50', py: 2 }}>
            <Container maxWidth="xl">
              <Typography variant="body2" color="text.secondary">
                {dashboard.description}
              </Typography>
            </Container>
          </Box>
        )}

        {/* ダッシュボードコンテンツ */}
        <Box 
          sx={{ 
            minHeight: isFullscreen ? '100vh' : 'calc(100vh - 128px)',
            backgroundColor: 'grey.50',
            p: isFullscreen ? 1 : 3
          }}
        >
          <Container maxWidth="xl" sx={{ height: '100%' }}>
            {dashboard.config.widgets && dashboard.config.widgets.length > 0 ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={layouts}
                onLayoutChange={handleLayoutChange}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={60}
                isDraggable={false}
                isResizable={false}
                compactType="vertical"
                margin={[16, 16]}
                containerPadding={[0, 0]}
              >
                {dashboard.config.widgets.map((widget) => (
                  <Paper
                    key={widget.id}
                    elevation={2}
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                      height: '100%',
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: 4,
                      }
                    }}
                  >
                    <WidgetRenderer widget={widget} />
                  </Paper>
                ))}
              </ResponsiveGridLayout>
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                height="400px"
                textAlign="center"
              >
                <Box>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    このダッシュボードにはコンテンツがありません
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    作成者がウィジェットを追加するまでお待ちください
                  </Typography>
                </Box>
              </Box>
            )}
          </Container>
        </Box>

        {/* フッター（全画面時は非表示） */}
        {!isFullscreen && (
          <Box 
            sx={{ 
              backgroundColor: 'grey.100', 
              py: 2, 
              borderTop: 1, 
              borderColor: 'divider' 
            }}
          >
            <Container maxWidth="xl">
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                flexWrap="wrap"
                gap={2}
              >
                <Typography variant="body2" color="text.secondary">
                  最終更新: {new Date(dashboard.updated_at).toLocaleDateString('ja-JP')}
                </Typography>
                
                <Box display="flex" alignItems="center" gap={2}>
                  <Typography variant="body2" color="text.secondary">
                    Powered by
                  </Typography>
                  <Link 
                    href="https://conea.ai" 
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="none"
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'primary.main',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    Conea
                  </Link>
                </Box>
              </Box>
            </Container>
          </Box>
        )}

        {/* 全画面時のキーボードショートカットヒント */}
        {isFullscreen && (
          <Box
            sx={{
              position: 'fixed',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              fontSize: '0.875rem',
              opacity: 0.8,
              zIndex: 1000,
            }}
          >
            ESCキーで全画面を終了
          </Box>
        )}
      </Box>
    </Fade>
  );
};