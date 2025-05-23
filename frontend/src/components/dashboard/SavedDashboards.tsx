import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Tooltip,
  Badge,
  Switch,
  FormControlLabel,
  useTheme,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Schedule as ScheduleIcon,
  Assessment as AnalyticsIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  Label as TagIcon
} from '@mui/icons-material';

interface SavedDashboard {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  category: string;
  tags: string[];
  author: string;
  isPublic: boolean;
  isBookmarked: boolean;
  isFavorite: boolean;
  isTemplate: boolean;
  widgetCount: number;
  views: number;
  likes: number;
  downloads: number;
  lastModified: Date;
  createdAt: Date;
  version: string;
  layout: any; // Dashboard layout data
}

interface DashboardCategory {
  id: string;
  name: string;
  description: string;
  count: number;
  color: string;
}

const SavedDashboards: React.FC = () => {
  const theme = useTheme();
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
  const [categories, setCategories] = useState<DashboardCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'views' | 'likes'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<SavedDashboard | null>(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    const mockCategories: DashboardCategory[] = [
      { id: 'sales', name: '売上分析', description: '売上関連のダッシュボード', count: 8, color: '#4caf50' },
      { id: 'marketing', name: 'マーケティング', description: 'マーケティング分析', count: 5, color: '#ff9800' },
      { id: 'operations', name: '運営管理', description: '業務運営関連', count: 6, color: '#2196f3' },
      { id: 'finance', name: '財務', description: '財務分析', count: 4, color: '#9c27b0' },
      { id: 'customer', name: '顧客分析', description: '顧客関連データ', count: 7, color: '#f44336' }
    ];

    const mockDashboards: SavedDashboard[] = [
      {
        id: '1',
        name: 'エグゼクティブサマリー',
        description: '経営陣向けの包括的なKPIダッシュボード',
        thumbnail: '/thumbnails/executive-summary.png',
        category: 'sales',
        tags: ['KPI', 'エグゼクティブ', '売上', '月次'],
        author: '管理者',
        isPublic: true,
        isBookmarked: true,
        isFavorite: true,
        isTemplate: false,
        widgetCount: 12,
        views: 1250,
        likes: 45,
        downloads: 23,
        lastModified: new Date('2024-03-15'),
        createdAt: new Date('2024-01-10'),
        version: '2.1',
        layout: {}
      },
      {
        id: '2',
        name: 'マーケティングROI分析',
        description: 'マーケティング施策の効果測定とROI分析',
        thumbnail: '/thumbnails/marketing-roi.png',
        category: 'marketing',
        tags: ['ROI', 'マーケティング', 'キャンペーン', 'コンバージョン'],
        author: 'マーケティング部',
        isPublic: true,
        isBookmarked: false,
        isFavorite: false,
        isTemplate: true,
        widgetCount: 8,
        views: 890,
        likes: 32,
        downloads: 15,
        lastModified: new Date('2024-03-12'),
        createdAt: new Date('2024-02-01'),
        version: '1.5',
        layout: {}
      },
      {
        id: '3',
        name: '在庫管理ダッシュボード',
        description: '在庫レベル、回転率、予測分析',
        thumbnail: '/thumbnails/inventory-management.png',
        category: 'operations',
        tags: ['在庫', '予測', 'アラート', '回転率'],
        author: '運営部',
        isPublic: false,
        isBookmarked: true,
        isFavorite: false,
        isTemplate: false,
        widgetCount: 10,
        views: 650,
        likes: 28,
        downloads: 8,
        lastModified: new Date('2024-03-10'),
        createdAt: new Date('2024-01-20'),
        version: '1.3',
        layout: {}
      },
      {
        id: '4',
        name: '顧客セグメント分析',
        description: '顧客の行動パターンとセグメント別分析',
        thumbnail: '/thumbnails/customer-segments.png',
        category: 'customer',
        tags: ['顧客', 'セグメント', 'RFM', 'LTV'],
        author: 'CRM担当',
        isPublic: true,
        isBookmarked: false,
        isFavorite: true,
        isTemplate: true,
        widgetCount: 15,
        views: 1100,
        likes: 52,
        downloads: 31,
        lastModified: new Date('2024-03-08'),
        createdAt: new Date('2024-01-15'),
        version: '2.0',
        layout: {}
      },
      {
        id: '5',
        name: 'プロモーション効果測定',
        description: 'キャンペーンとプロモーションの効果分析',
        category: 'marketing',
        tags: ['プロモーション', '効果測定', 'A/Bテスト'],
        author: 'プロモーション担当',
        isPublic: false,
        isBookmarked: true,
        isFavorite: false,
        isTemplate: false,
        widgetCount: 7,
        views: 420,
        likes: 18,
        downloads: 5,
        lastModified: new Date('2024-03-05'),
        createdAt: new Date('2024-02-10'),
        version: '1.1',
        layout: {}
      }
    ];

    setCategories(mockCategories);
    setDashboards(mockDashboards);
  };

  const toggleBookmark = (dashboardId: string) => {
    setDashboards(prev =>
      prev.map(dashboard =>
        dashboard.id === dashboardId
          ? { ...dashboard, isBookmarked: !dashboard.isBookmarked }
          : dashboard
      )
    );
  };

  const toggleFavorite = (dashboardId: string) => {
    setDashboards(prev =>
      prev.map(dashboard =>
        dashboard.id === dashboardId
          ? { ...dashboard, isFavorite: !dashboard.isFavorite }
          : dashboard
      )
    );
  };

  const duplicateDashboard = (dashboard: SavedDashboard) => {
    const newDashboard: SavedDashboard = {
      ...dashboard,
      id: `${dashboard.id}_copy_${Date.now()}`,
      name: `${dashboard.name} (コピー)`,
      isPublic: false,
      isBookmarked: false,
      views: 0,
      likes: 0,
      downloads: 0,
      createdAt: new Date(),
      lastModified: new Date()
    };

    setDashboards(prev => [newDashboard, ...prev]);
  };

  const deleteDashboard = (dashboardId: string) => {
    setDashboards(prev => prev.filter(dashboard => dashboard.id !== dashboardId));
  };

  const filteredDashboards = dashboards.filter(dashboard => {
    const matchesSearch = dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dashboard.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dashboard.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || dashboard.category === selectedCategory;
    const matchesPublic = !showOnlyPublic || dashboard.isPublic;
    const matchesFavorites = !showOnlyFavorites || dashboard.isFavorite;
    const matchesTags = filterTags.length === 0 || filterTags.some(tag => dashboard.tags.includes(tag));

    return matchesSearch && matchesCategory && matchesPublic && matchesFavorites && matchesTags;
  });

  const sortedDashboards = [...filteredDashboards].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = a.lastModified.getTime() - b.lastModified.getTime();
        break;
      case 'views':
        comparison = a.views - b.views;
        break;
      case 'likes':
        comparison = a.likes - b.likes;
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const renderCategoryFilter = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>カテゴリ</Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Chip
              label={`すべて (${dashboards.length})`}
              onClick={() => setSelectedCategory('all')}
              color={selectedCategory === 'all' ? 'primary' : 'default'}
              variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
            />
          </Grid>
          {categories.map(category => (
            <Grid item key={category.id}>
              <Chip
                label={`${category.name} (${category.count})`}
                onClick={() => setSelectedCategory(category.id)}
                color={selectedCategory === category.id ? 'primary' : 'default'}
                variant={selectedCategory === category.id ? 'filled' : 'outlined'}
                sx={{ 
                  borderColor: category.color,
                  color: selectedCategory === category.id ? 'white' : category.color
                }}
              />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderDashboardCard = (dashboard: SavedDashboard) => (
    <Card key={dashboard.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {dashboard.thumbnail && (
        <Box
          sx={{
            height: 160,
            backgroundImage: `url(${dashboard.thumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <DashboardIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.5) }} />
        </Box>
      )}
      
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
            {dashboard.name}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => {
              setSelectedDashboard(dashboard);
              setAnchorEl(e.currentTarget);
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {dashboard.description}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
          {dashboard.isTemplate && <Chip label="テンプレート" size="small" color="info" />}
          {dashboard.isPublic ? (
            <Chip icon={<PublicIcon />} label="公開" size="small" color="success" />
          ) : (
            <Chip icon={<PrivateIcon />} label="非公開" size="small" color="default" />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
          {dashboard.tags.slice(0, 3).map(tag => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
          {dashboard.tags.length > 3 && (
            <Chip label={`+${dashboard.tags.length - 3}`} size="small" variant="outlined" />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            作成者: {dashboard.author}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ウィジェット: {dashboard.widgetCount}個
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ViewIcon fontSize="small" color="action" />
            <Typography variant="caption">{dashboard.views}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarIcon fontSize="small" color="action" />
            <Typography variant="caption">{dashboard.likes}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DownloadIcon fontSize="small" color="action" />
            <Typography variant="caption">{dashboard.downloads}</Typography>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          最終更新: {dashboard.lastModified.toLocaleDateString()}
        </Typography>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          <IconButton
            size="small"
            onClick={() => toggleBookmark(dashboard.id)}
            color={dashboard.isBookmarked ? 'primary' : 'default'}
          >
            {dashboard.isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => toggleFavorite(dashboard.id)}
            color={dashboard.isFavorite ? 'warning' : 'default'}
          >
            {dashboard.isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Box>

        <Box>
          <Button size="small" variant="outlined">
            プレビュー
          </Button>
          <Button size="small" variant="contained" sx={{ ml: 1 }}>
            使用
          </Button>
        </Box>
      </CardActions>
    </Card>
  );

  const renderDashboardList = (dashboard: SavedDashboard) => (
    <Card key={dashboard.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 60, height: 60 }}>
            <DashboardIcon />
          </Avatar>
          
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h6">{dashboard.name}</Typography>
              {dashboard.isTemplate && <Chip label="テンプレート" size="small" color="info" />}
              {dashboard.isPublic ? (
                <Chip icon={<PublicIcon />} label="公開" size="small" color="success" />
              ) : (
                <Chip icon={<PrivateIcon />} label="非公開" size="small" color="default" />
              )}
            </Box>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {dashboard.description}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              {dashboard.tags.slice(0, 5).map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
            
            <Typography variant="caption" color="text.secondary">
              作成者: {dashboard.author} | 
              ウィジェット: {dashboard.widgetCount}個 | 
              最終更新: {dashboard.lastModified.toLocaleDateString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ViewIcon fontSize="small" color="action" />
                <Typography variant="caption">{dashboard.views}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon fontSize="small" color="action" />
                <Typography variant="caption">{dashboard.likes}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DownloadIcon fontSize="small" color="action" />
                <Typography variant="caption">{dashboard.downloads}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => toggleBookmark(dashboard.id)}
                color={dashboard.isBookmarked ? 'primary' : 'default'}
              >
                {dashboard.isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => toggleFavorite(dashboard.id)}
                color={dashboard.isFavorite ? 'warning' : 'default'}
              >
                {dashboard.isFavorite ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
              <Button size="small" variant="contained">
                使用
              </Button>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <BookmarkIcon color="primary" sx={{ fontSize: 40 }} />
        保存済みダッシュボード
      </Typography>

      {/* Search and Filter Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="ダッシュボードを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>並び順</InputLabel>
                <Select
                  value={sortBy}
                  label="並び順"
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <MenuItem value="date">更新日</MenuItem>
                  <MenuItem value="name">名前</MenuItem>
                  <MenuItem value="views">閲覧数</MenuItem>
                  <MenuItem value="likes">いいね数</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>表示</InputLabel>
                <Select
                  value={`${sortOrder}-${viewMode}`}
                  label="表示"
                  onChange={(e) => {
                    const [order, mode] = e.target.value.split('-');
                    setSortOrder(order as any);
                    setViewMode(mode as any);
                  }}
                >
                  <MenuItem value="desc-grid">新しい順（グリッド）</MenuItem>
                  <MenuItem value="asc-grid">古い順（グリッド）</MenuItem>
                  <MenuItem value="desc-list">新しい順（リスト）</MenuItem>
                  <MenuItem value="asc-list">古い順（リスト）</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showOnlyPublic}
                      onChange={(e) => setShowOnlyPublic(e.target.checked)}
                    />
                  }
                  label="公開のみ"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showOnlyFavorites}
                      onChange={(e) => setShowOnlyFavorites(e.target.checked)}
                    />
                  }
                  label="お気に入りのみ"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Category Filter */}
      {renderCategoryFilter()}

      {/* Results Summary */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {sortedDashboards.length} 件のダッシュボードが見つかりました
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialog(true)}
          >
            インポート
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
          >
            新規作成
          </Button>
        </Box>
      </Box>

      {/* Dashboard Grid/List */}
      {viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {sortedDashboards.map(dashboard => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={dashboard.id}>
              {renderDashboardCard(dashboard)}
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box>
          {sortedDashboards.map(dashboard => renderDashboardList(dashboard))}
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>
          <EditIcon sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDashboard) duplicateDashboard(selectedDashboard);
          setAnchorEl(null);
        }}>
          <CopyIcon sx={{ mr: 1 }} />
          複製
        </MenuItem>
        <MenuItem onClick={() => {
          setShareDialog(true);
          setAnchorEl(null);
        }}>
          <ShareIcon sx={{ mr: 1 }} />
          共有
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <DownloadIcon sx={{ mr: 1 }} />
          エクスポート
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDashboard) deleteDashboard(selectedDashboard.id);
          setAnchorEl(null);
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          削除
        </MenuItem>
      </Menu>

      {/* Share Dialog */}
      <Dialog
        open={shareDialog}
        onClose={() => setShareDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ダッシュボードを共有</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            このダッシュボードを他のユーザーと共有できます
          </Typography>
          <TextField
            fullWidth
            label="共有URL"
            value={`https://example.com/dashboard/${selectedDashboard?.id}`}
            margin="normal"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton>
                  <CopyIcon />
                </IconButton>
              )
            }}
          />
          <FormControlLabel
            control={<Switch />}
            label="公開ダッシュボードとして設定"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialog(false)}>キャンセル</Button>
          <Button variant="contained">共有</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SavedDashboards;