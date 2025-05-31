import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Avatar,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  Pagination,
  Skeleton,
  Autocomplete,
  Fab,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Group as GroupIcon,
  Visibility as VisibilityIcon,
  GetApp as GetAppIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DashboardItem {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  visibility: 'public' | 'private' | 'limited';
  created_by: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  unique_visitors: number;
  is_favorite: boolean;
  is_template: boolean;
  template_category?: string;
  thumbnail_url?: string;
  share_token?: string;
}

interface DashboardListProps {
  onDashboardSelect: (dashboard: DashboardItem) => void;
  onCreateNew: () => void;
}

export const DashboardList: React.FC<DashboardListProps> = ({
  onDashboardSelect,
  onCreateNew,
}) => {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [filteredDashboards, setFilteredDashboards] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // フィルタリング・検索用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showTemplatesOnly, setShowTemplatesOnly] = useState(false);
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  
  // ダイアログとメニューの状態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardItem | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // 利用可能なタグとカテゴリ（実際の実装では動的に取得）
  const availableTags = ['売上分析', '在庫管理', '顧客分析', 'KPI', 'レポート', 'リアルタイム', 'EC', '小売', '製造', 'CRM'];
  const availableCategories = ['EC', '小売', '製造', 'CRM', 'マーケティング', 'ファイナンス', 'カスタム'];

  useEffect(() => {
    fetchDashboards();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dashboards, searchQuery, selectedTags, visibilityFilter, categoryFilter, showFavoritesOnly, showTemplatesOnly, sortBy, sortOrder]);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      // TODO: 実際のAPI呼び出し
      // const response = await fetch('/api/v2/dashboards');
      // const data = await response.json();
      
      // モックデータ
      const mockDashboards: DashboardItem[] = [
        {
          id: '1',
          name: '月次売上分析ダッシュボード',
          description: 'EC売上の月次トレンドと主要KPIを表示',
          tags: ['売上分析', 'EC', 'KPI'],
          visibility: 'private',
          created_by: 'user1',
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-20T15:45:00Z',
          access_count: 245,
          unique_visitors: 89,
          is_favorite: true,
          is_template: false,
          template_category: 'EC',
        },
        {
          id: '2', 
          name: '在庫管理ダッシュボード',
          description: '在庫レベル、回転率、補充スケジュールを監視',
          tags: ['在庫管理', '小売', 'リアルタイム'],
          visibility: 'public',
          created_by: 'user2',
          created_at: '2024-01-10T08:15:00Z',
          updated_at: '2024-01-18T12:20:00Z',
          access_count: 156,
          unique_visitors: 67,
          is_favorite: false,
          is_template: true,
          template_category: '小売',
        },
        {
          id: '3',
          name: '顧客分析ダッシュボード',
          description: '顧客セグメント、購買行動、満足度を分析',
          tags: ['顧客分析', 'CRM', 'マーケティング'],
          visibility: 'limited',
          created_by: 'user1',
          created_at: '2024-01-12T14:00:00Z',
          updated_at: '2024-01-19T09:30:00Z',
          access_count: 89,
          unique_visitors: 34,
          is_favorite: true,
          is_template: false,
        },
      ];
      
      setDashboards(mockDashboards);
    } catch (err) {
      setError('ダッシュボード一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...dashboards];

    // 検索クエリによるフィルタリング
    if (searchQuery) {
      filtered = filtered.filter(dashboard =>
        dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dashboard.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // タグによるフィルタリング
    if (selectedTags.length > 0) {
      filtered = filtered.filter(dashboard =>
        selectedTags.some(tag => dashboard.tags.includes(tag))
      );
    }

    // 公開設定によるフィルタリング
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(dashboard => dashboard.visibility === visibilityFilter);
    }

    // カテゴリによるフィルタリング
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(dashboard => dashboard.template_category === categoryFilter);
    }

    // お気に入りのみ表示
    if (showFavoritesOnly) {
      filtered = filtered.filter(dashboard => dashboard.is_favorite);
    }

    // テンプレートのみ表示
    if (showTemplatesOnly) {
      filtered = filtered.filter(dashboard => dashboard.is_template);
    }

    // ソート
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        case 'access_count':
          aValue = a.access_count;
          bValue = b.access_count;
          break;
        default:
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredDashboards(filtered);
    setCurrentPage(1); // フィルター変更時はページを1に戻す
  };

  const handleFavoriteToggle = async (dashboardId: string) => {
    try {
      // TODO: 実際のAPI呼び出し
      // await fetch(`/api/v2/dashboards/${dashboardId}/favorite`, { method: 'POST' });
      
      setDashboards(prev =>
        prev.map(dashboard =>
          dashboard.id === dashboardId
            ? { ...dashboard, is_favorite: !dashboard.is_favorite }
            : dashboard
        )
      );
    } catch (err) {
      setError('お気に入りの更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!selectedDashboard) return;

    try {
      // TODO: 実際のAPI呼び出し
      // await fetch(`/api/v2/dashboards/${selectedDashboard.id}`, { method: 'DELETE' });
      
      setDashboards(prev => prev.filter(d => d.id !== selectedDashboard.id));
      setDeleteDialogOpen(false);
      setSelectedDashboard(null);
    } catch (err) {
      setError('ダッシュボードの削除に失敗しました');
    }
  };

  const handleShare = (dashboard: DashboardItem) => {
    setSelectedDashboard(dashboard);
    setShareDialogOpen(true);
    setAnchorEl(null);
  };

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/public/dashboard/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    // TODO: スナックバーで成功メッセージを表示
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <PublicIcon fontSize="small" />;
      case 'limited':
        return <GroupIcon fontSize="small" />;
      default:
        return <LockIcon fontSize="small" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return '公開';
      case 'limited':
        return '限定公開';
      default:
        return '非公開';
    }
  };

  // ページネーション用のダッシュボード
  const paginatedDashboards = filteredDashboards.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <Skeleton variant="rectangular" height={140} />
                <CardContent>
                  <Skeleton variant="text" height={32} />
                  <Skeleton variant="text" height={20} />
                  <Skeleton variant="text" height={20} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          保存されたダッシュボード
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateNew}
          size="large"
        >
          新規作成
        </Button>
      </Box>

      {/* フィルター・検索バー */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* 検索 */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="ダッシュボードを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>

            {/* タグフィルター */}
            <Grid item xs={12} md={3}>
              <Autocomplete
                multiple
                options={availableTags}
                value={selectedTags}
                onChange={(event, value) => setSelectedTags(value)}
                renderInput={(params) => (
                  <TextField {...params} label="タグ" placeholder="タグを選択" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option}
                      {...getTagProps({ index })}
                      size="small"
                      key={option}
                    />
                  ))
                }
              />
            </Grid>

            {/* 公開設定フィルター */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>公開設定</InputLabel>
                <Select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value)}
                  label="公開設定"
                >
                  <MenuItem value="all">すべて</MenuItem>
                  <MenuItem value="public">公開</MenuItem>
                  <MenuItem value="private">非公開</MenuItem>
                  <MenuItem value="limited">限定公開</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* ソート */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>ソート</InputLabel>
                <Select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('_');
                    setSortBy(field);
                    setSortOrder(order as 'asc' | 'desc');
                  }}
                  label="ソート"
                >
                  <MenuItem value="updated_at_desc">更新日（新しい順）</MenuItem>
                  <MenuItem value="updated_at_asc">更新日（古い順）</MenuItem>
                  <MenuItem value="created_at_desc">作成日（新しい順）</MenuItem>
                  <MenuItem value="created_at_asc">作成日（古い順）</MenuItem>
                  <MenuItem value="name_asc">名前（A-Z）</MenuItem>
                  <MenuItem value="name_desc">名前（Z-A）</MenuItem>
                  <MenuItem value="access_count_desc">アクセス数（多い順）</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 追加フィルター */}
            <Grid item xs={12}>
              <Box display="flex" gap={1}>
                <Button
                  variant={showFavoritesOnly ? "contained" : "outlined"}
                  size="small"
                  startIcon={<FavoriteIcon />}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  お気に入りのみ
                </Button>
                <Button
                  variant={showTemplatesOnly ? "contained" : "outlined"}
                  size="small"
                  startIcon={<DashboardIcon />}
                  onClick={() => setShowTemplatesOnly(!showTemplatesOnly)}
                >
                  テンプレートのみ
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* ダッシュボード一覧 */}
      <Grid container spacing={3}>
        {paginatedDashboards.map((dashboard) => (
          <Grid item xs={12} sm={6} md={4} key={dashboard.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
              onClick={() => onDashboardSelect(dashboard)}
            >
              {/* サムネイル（将来的に実装） */}
              <Box
                sx={{
                  height: 140,
                  backgroundColor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <DashboardIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                
                {/* テンプレートバッジ */}
                {dashboard.is_template && (
                  <Chip
                    label="テンプレート"
                    size="small"
                    color="primary"
                    sx={{ position: 'absolute', top: 8, left: 8 }}
                  />
                )}

                {/* お気に入りボタン */}
                <IconButton
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavoriteToggle(dashboard.id);
                  }}
                >
                  {dashboard.is_favorite ? (
                    <FavoriteIcon color="error" />
                  ) : (
                    <FavoriteBorderIcon />
                  )}
                </IconButton>
              </Box>

              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom noWrap>
                  {dashboard.name}
                </Typography>
                
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    mb: 2,
                    minHeight: 40,
                  }}
                >
                  {dashboard.description || 'ダッシュボードの説明がありません'}
                </Typography>

                {/* タグ */}
                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {dashboard.tags.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                  {dashboard.tags.length > 3 && (
                    <Chip label={`+${dashboard.tags.length - 3}`} size="small" variant="outlined" />
                  )}
                </Box>

                {/* メタデータ */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getVisibilityIcon(dashboard.visibility)}
                    <Typography variant="caption" color="text.secondary">
                      {getVisibilityLabel(dashboard.visibility)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    <VisibilityIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                    {dashboard.access_count}
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  更新: {formatDistanceToNow(new Date(dashboard.updated_at), { 
                    addSuffix: true, 
                    locale: ja 
                  })}
                </Typography>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDashboardSelect(dashboard);
                  }}
                >
                  編集
                </Button>
                
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDashboard(dashboard);
                    setAnchorEl(e.currentTarget);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ページネーション */}
      {filteredDashboards.length > itemsPerPage && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={Math.ceil(filteredDashboards.length / itemsPerPage)}
            page={currentPage}
            onChange={(event, page) => setCurrentPage(page)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* 空の状態 */}
      {filteredDashboards.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <DashboardIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            ダッシュボードが見つかりません
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            検索条件を変更するか、新しいダッシュボードを作成してください
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateNew}>
            新規作成
          </Button>
        </Box>
      )}

      {/* アクションメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleShare(selectedDashboard!)}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>共有</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          // TODO: エクスポート機能
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <GetAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>エクスポート</ListItemText>
        </MenuItem>
        
        <MenuItem 
          onClick={() => {
            setDeleteDialogOpen(true);
            setAnchorEl(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
      </Menu>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>ダッシュボードの削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{selectedDashboard?.name}」を削除しますか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 共有ダイアログ */}
      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ダッシュボードを共有</DialogTitle>
        <DialogContent>
          {selectedDashboard?.share_token ? (
            <Box>
              <Typography variant="body2" gutterBottom>
                このダッシュボードの共有リンク:
              </Typography>
              <Box display="flex" gap={1} alignItems="center">
                <TextField
                  fullWidth
                  value={`${window.location.origin}/public/dashboard/${selectedDashboard.share_token}`}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <IconButton
                  onClick={() => copyShareLink(selectedDashboard.share_token!)}
                  title="リンクをコピー"
                >
                  <ContentCopyIcon />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2">
              このダッシュボードは共有設定がされていません。
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      {/* 新規作成フローティングボタン（モバイル用） */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' },
        }}
        onClick={onCreateNew}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};