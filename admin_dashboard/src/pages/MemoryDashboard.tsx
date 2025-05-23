import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  Memory as MemoryIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Close as CloseIcon,
  Sync as SyncIcon,
  Share as ShareIcon
} from '@mui/icons-material';

interface Memory {
  id: string;
  content: string;
  created_at: string;
  relevance_score?: number;
  source?: string;
}

interface MemoryStats {
  user_id: string;
  total_memories: number;
  recent_memories: number;
  last_updated: string;
  service_status: string;
}

const MemoryDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const userId = 'mourigenta';

  useEffect(() => {
    loadStats();
    loadRecentMemories();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/memory/stats/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const loadRecentMemories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/memory/recent/${userId}?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setRecentMemories(data.memories || []);
      }
    } catch (error) {
      setError('最近のメモリの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const searchMemories = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/memory/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          query: searchQuery,
          limit: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories || []);
      } else {
        setError('検索に失敗しました');
      }
    } catch (error) {
      setError('検索エラーが発生しました');
    } finally {
      setSearchLoading(false);
    }
  };

  const saveMemory = async () => {
    if (!newMemoryText.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          text: newMemoryText,
          source: 'dashboard-manual'
        })
      });

      if (response.ok) {
        setNewMemoryText('');
        loadStats();
        loadRecentMemories();
        setError(null);
      } else {
        setError('メモリの保存に失敗しました');
      }
    } catch (error) {
      setError('保存エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      action();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getSourceColor = (source?: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'default' => {
    const sourceColors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'default' } = {
      'claude-code': 'primary',
      'slack-claude': 'secondary',
      'slack-openai': 'success',
      'slack-gemini': 'warning',
      'dashboard-manual': 'error',
      'conea-dashboard': 'primary',
      'slack-bot': 'secondary',
      'api': 'success',
      'admin-dashboard-test': 'warning',
      'simple-fallback': 'warning'
    };
    return sourceColors[source || ''] || 'default';
  };

  // New memory sync and sharing functions
  const [syncLoading, setSyncLoading] = useState(false);
  const [sharingStatus, setSharingStatus] = useState<any>(null);

  const syncMemories = async () => {
    setSyncLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/memory/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setError(null);
        alert(`同期完了: ${data.synced}/${data.total} メモリを同期しました`);
        loadStats();
        loadRecentMemories();
        loadSharingStatus();
      } else {
        const errorData = await response.json();
        setError(`同期失敗: ${errorData.error}`);
      }
    } catch (error) {
      setError('同期エラーが発生しました');
    } finally {
      setSyncLoading(false);
    }
  };

  const loadSharingStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/memory/sharing-status');
      if (response.ok) {
        const data = await response.json();
        setSharingStatus(data);
      }
    } catch (error) {
      console.error('Failed to load sharing status:', error);
    }
  };

  useEffect(() => {
    loadSharingStatus();
  }, []);

  // Service status helper functions
  const getServiceStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'openmemory-connected': return 'OpenMemory接続中';
      case 'simple-fallback': return 'ローカルメモリ';
      case 'simple-fallback-emergency': return '緊急フォールバック';
      case 'connected': return '接続中';
      case 'disconnected': return '未接続';
      default: return status || '不明';
    }
  };

  const getServiceStatusColor = (status: string | undefined): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'openmemory-connected':
      case 'connected': 
        return 'success';
      case 'simple-fallback':
      case 'simple-fallback-emergency':
        return 'warning';
      case 'disconnected':
        return 'error';
      default: 
        return 'default';
    }
  };

  const getConnectionStatusText = (status: string | undefined) => {
    switch (status) {
      case 'openmemory-connected': return '✅ OpenMemory接続中';
      case 'simple-fallback': return '⚠️ ローカルメモリ使用中';
      case 'simple-fallback-emergency': return '⚠️ 緊急フォールバック';
      case 'connected': return '✅ 接続中';
      case 'disconnected': return '❌ 未接続';
      default: return '❓ 状態不明';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MemoryIcon /> OpenMemory ダッシュボード
      </Typography>

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                総メモリ数
              </Typography>
              <Typography variant="h5">
                {stats?.total_memories || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                最近のメモリ (7日)
              </Typography>
              <Typography variant="h5">
                {stats?.recent_memories || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                サービス状態
              </Typography>
              <Chip
                label={getServiceStatusLabel(stats?.service_status)}
                color={getServiceStatusColor(stats?.service_status)}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                最終更新
              </Typography>
              <Typography variant="body2">
                {stats ? formatDate(stats.last_updated) : '-'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* タブナビゲーション */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="メモリ検索" icon={<SearchIcon />} />
          <Tab label="新規保存" icon={<SaveIcon />} />
          <Tab label="最近のメモリ" icon={<HistoryIcon />} />
          <Tab label="統計" icon={<AnalyticsIcon />} />
          <Tab label="LLM間共有" icon={<ShareIcon />} />
        </Tabs>
      </Paper>

      {/* メモリ検索タブ */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="メモリを検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, searchMemories)}
                placeholder="キーワードで関連するメモリを検索..."
              />
              <Button
                variant="contained"
                onClick={searchMemories}
                disabled={searchLoading}
                startIcon={searchLoading ? <CircularProgress size={20} /> : <SearchIcon />}
              >
                検索
              </Button>
            </Box>

            {memories.length > 0 && (
              <List>
                {memories.map((memory, index) => (
                  <React.Fragment key={memory.id}>
                    <ListItem
                      button
                      onClick={() => setSelectedMemory(memory)}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography variant="body1">
                              {memory.content.length > 200
                                ? `${memory.content.substring(0, 200)}...`
                                : memory.content}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, ml: 2 }}>
                              {memory.relevance_score && (
                                <Chip
                                  size="small"
                                  label={`${(memory.relevance_score * 100).toFixed(0)}%`}
                                  color="primary"
                                />
                              )}
                              {memory.source && (
                                <Chip
                                  size="small"
                                  label={memory.source}
                                  color={getSourceColor(memory.source)}
                                />
                              )}
                            </Box>
                          </Box>
                        }
                        secondary={formatDate(memory.created_at)}
                      />
                    </ListItem>
                    {index < memories.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}

            {searchQuery && memories.length === 0 && !searchLoading && (
              <Typography color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                「{searchQuery}」に関連するメモリが見つかりませんでした
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* 新規保存タブ */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="新しいメモリを保存"
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="記憶したい内容を入力してください..."
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              onClick={saveMemory}
              disabled={loading || !newMemoryText.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              保存
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 最近のメモリタブ */}
      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">最近のメモリ</Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={loadRecentMemories}
                disabled={loading}
              >
                更新
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {recentMemories.map((memory, index) => (
                  <React.Fragment key={memory.id}>
                    <ListItem
                      button
                      onClick={() => setSelectedMemory(memory)}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography variant="body1">
                              {memory.content}
                            </Typography>
                            {memory.source && (
                              <Chip
                                size="small"
                                label={memory.source}
                                color={getSourceColor(memory.source)}
                                sx={{ ml: 2, flexShrink: 0 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={formatDate(memory.created_at)}
                      />
                    </ListItem>
                    {index < recentMemories.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {/* 統計タブ */}
      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              メモリ統計
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    基本統計
                  </Typography>
                  <Typography>総メモリ数: {stats?.total_memories || 0}</Typography>
                  <Typography>最近のメモリ: {stats?.recent_memories || 0}</Typography>
                  <Typography>サービス状態: {stats?.service_status || 'unknown'}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    システム情報
                  </Typography>
                  <Typography>ユーザーID: {userId}</Typography>
                  <Typography>最終更新: {stats ? formatDate(stats.last_updated) : '-'}</Typography>
                  <Typography>
                    OpenMemory連携: {getConnectionStatusText(stats?.service_status)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* LLM間共有タブ */}
      {activeTab === 4 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShareIcon /> LLM間メモリ共有システム
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Claude、OpenAI、Gemini間でメモリを共有し、AI間での継続的な学習を可能にします
            </Typography>

            {/* 共有状態表示 */}
            {sharingStatus && (
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: sharingStatus.openmemory_api.connected ? 'success.light' : 'warning.light' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      OpenMemory API
                    </Typography>
                    <Typography variant="h6">
                      {sharingStatus.openmemory_api.connected ? '✅ 接続中' : '❌ 未接続'}
                    </Typography>
                    {sharingStatus.openmemory_api.error && (
                      <Typography variant="body2" color="error">
                        Error: {sharingStatus.openmemory_api.error}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Simple Memory (Fallback)
                    </Typography>
                    <Typography variant="h6">
                      {sharingStatus.simple_memory.total_memories} メモリ
                    </Typography>
                    <Typography variant="body2">
                      Status: {sharingStatus.simple_memory.status}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: sharingStatus.cross_llm_sharing.enabled ? 'success.light' : 'error.light' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      LLM間共有
                    </Typography>
                    <Typography variant="h6">
                      {sharingStatus.cross_llm_sharing.enabled ? '✅ 有効' : '❌ 無効'}
                    </Typography>
                    <Typography variant="body2">
                      Fallback: {sharingStatus.cross_llm_sharing.fallback_active ? 'Active' : 'Inactive'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* 操作ボタン */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={syncMemories}
                  disabled={syncLoading}
                  color="primary"
                >
                  {syncLoading ? <CircularProgress size={20} /> : 'メモリ同期実行'}
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadSharingStatus}
                  color="secondary"
                >
                  状態更新
                </Button>
              </Grid>
            </Grid>

            {/* 説明セクション */}
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle1" gutterBottom>
                📋 メモリ共有の仕組み
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                <Typography component="li" variant="body2">
                  各LLM（Claude、OpenAI、Gemini）の会話がOpenMemoryに自動保存されます
                </Typography>
                <Typography component="li" variant="body2">
                  OpenMemory APIが利用できない場合、Simple Memory（ローカル）にフォールバックします
                </Typography>
                <Typography component="li" variant="body2">
                  「メモリ同期実行」でOpenMemoryの内容をローカルメモリにコピーし、LLM間共有を確実にします
                </Typography>
                <Typography component="li" variant="body2">
                  これにより、Claudeとの会話をOpenAIが参照したり、Geminiの回答をClaudeが活用できます
                </Typography>
              </Box>
            </Paper>
          </CardContent>
        </Card>
      )}

      {/* メモリ詳細ダイアログ */}
      <Dialog
        open={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          メモリ詳細
          <IconButton onClick={() => setSelectedMemory(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedMemory && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {selectedMemory.content}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">作成日時</Typography>
                  <Typography>{formatDate(selectedMemory.created_at)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">ソース</Typography>
                  <Chip
                    size="small"
                    label={selectedMemory.source || 'unknown'}
                    color={getSourceColor(selectedMemory.source)}
                  />
                </Grid>
                {selectedMemory.relevance_score && (
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">関連度スコア</Typography>
                    <Typography>{(selectedMemory.relevance_score * 100).toFixed(1)}%</Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="subtitle2">メモリID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedMemory.id}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMemory(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemoryDashboard;