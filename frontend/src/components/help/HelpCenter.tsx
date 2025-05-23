/**
 * ヘルプセンターコンポーネント
 * ユーザーが利用可能なヘルプ記事を検索・閲覧するためのインターフェース
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Divider,
  Button,
  Grid,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Drawer,
  useTheme,
  useMediaQuery,
  Toolbar,
  Breadcrumbs,
  Link,
  Fade
} from '@mui/material';
import {
  Search as SearchIcon,
  Article as ArticleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowBack as ArrowBackIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Close as CloseIcon,
  PlayCircleOutline as VideoIcon,
  LinkOutlined as LinkIcon,
  Home as HomeIcon,
  Info as InfoIcon,
  Help as HelpIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  DataObject as ApiIcon,
  BarChart as AnalyticsIcon,
  Description as ReportIcon,
  CloudOff as OfflineIcon,
  ErrorOutline as TroubleshootingIcon
} from '@mui/icons-material';
import { useHelp } from '../../hooks/useHelp';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { HelpCategory, HelpCategoryId } from '../../services/helpService';
import helpService from '../../services/helpService';

interface HelpCenterProps {
  open: boolean;
  onClose: () => void;
  initialCategory?: HelpCategoryId;
  initialArticleId?: string;
  fullWidth?: boolean;
}

// カテゴリー別アイコンの設定
const getCategoryIcon = (categoryId: HelpCategoryId) => {
  const icons = {
    'getting-started': <InfoIcon />,
    'dashboard': <DashboardIcon />,
    'connections': <CloudIcon />,
    'api-settings': <ApiIcon />,
    'analytics': <AnalyticsIcon />,
    'reports': <ReportIcon />,
    'offline': <OfflineIcon />,
    'settings': <SettingsIcon />,
    'troubleshooting': <TroubleshootingIcon />
  };
  
  return icons[categoryId] || <HelpIcon />;
};

const HelpCenter: React.FC<HelpCenterProps> = ({
  open,
  onClose,
  initialCategory,
  initialArticleId,
  fullWidth = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<HelpCategoryId>>(new Set());
  const [showingMobileCategory, setShowingMobileCategory] = useState(false);
  const [showingMobileArticle, setShowingMobileArticle] = useState(false);
  
  const {
    categories,
    articles,
    selectedCategory,
    selectedArticle,
    relatedArticles,
    searchQuery,
    searchResults,
    isLoading,
    isSearching,
    error,
    
    selectCategory,
    selectArticle,
    setSearchQuery,
    search,
    selectSearchResult
  } = useHelp({
    initialCategory,
    autoSearch: true
  });
  
  // 初期記事の読み込み
  useEffect(() => {
    if (initialArticleId && !isLoading) {
      selectArticle(initialArticleId);
    }
  }, [initialArticleId, isLoading, selectArticle]);
  
  // カテゴリーの展開/折りたたみ
  const toggleCategory = (categoryId: HelpCategoryId) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };
  
  // 記事をブックマークに追加/削除
  const toggleBookmark = (articleId: string) => {
    setBookmarkedArticles(prev => {
      if (prev.includes(articleId)) {
        return prev.filter(id => id !== articleId);
      } else {
        return [...prev, articleId];
      }
    });
  };
  
  // 記事が選択されたときの処理
  const handleArticleSelect = (articleId: string) => {
    selectArticle(articleId);
    if (isMobile) {
      setShowingMobileArticle(true);
    }
  };
  
  // カテゴリーが選択されたときの処理
  const handleCategorySelect = (categoryId: HelpCategoryId) => {
    selectCategory(categoryId);
    if (isMobile) {
      setShowingMobileCategory(true);
    }
  };
  
  // モバイルでの戻るボタン処理
  const handleMobileBack = () => {
    if (showingMobileArticle) {
      setShowingMobileArticle(false);
    } else if (showingMobileCategory) {
      setShowingMobileCategory(false);
    }
  };
  
  // 検索実行
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(searchQuery);
  };
  
  // ブレッドクラムの生成
  const renderBreadcrumbs = () => {
    return (
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link 
          component="button"
          variant="body2"
          onClick={() => {
            selectCategory(null as any);
            setShowingMobileCategory(false);
            setShowingMobileArticle(false);
          }}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          ヘルプセンター
        </Link>
        
        {selectedCategory && (
          <Link
            component="button"
            variant="body2" 
            onClick={() => {
              if (showingMobileArticle) {
                setShowingMobileArticle(false);
              }
            }}
          >
            {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
          </Link>
        )}
        
        {selectedArticle && (
          <Typography color="text.primary" variant="body2">
            {selectedArticle.title}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };
  
  // 検索結果の表示
  const renderSearchResults = () => {
    if (searchQuery.length === 0) {
      return null;
    }
    
    if (isSearching) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (searchResults.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          「{searchQuery}」に一致する記事が見つかりませんでした
        </Alert>
      );
    }
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          「{searchQuery}」の検索結果
        </Typography>
        <List>
          {searchResults.map((result) => (
            <ListItem 
              key={result.articleId} 
              disablePadding
              divider
            >
              <ListItemButton onClick={() => selectSearchResult(result)}>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={result.title}
                  secondary={
                    <>
                      <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                        カテゴリー: {result.categoryName}
                      </Box>
                      <Box component="span" sx={{ 
                        display: 'block', 
                        fontSize: '0.875rem',
                        color: 'text.secondary'
                      }}>
                        {result.snippet}
                      </Box>
                    </>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };
  
  // カテゴリー一覧の表示
  const renderCategories = () => {
    return (
      <List sx={{ width: '100%' }}>
        {categories.map((category) => (
          <React.Fragment key={category.id}>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => toggleCategory(category.id)}
                selected={selectedCategory === category.id}
              >
                <ListItemIcon>
                  {getCategoryIcon(category.id)}
                </ListItemIcon>
                <ListItemText 
                  primary={category.name}
                  secondary={category.description}
                />
                {expandedCategories.has(category.id) ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </ListItemButton>
            </ListItem>
            
            {expandedCategories.has(category.id) && (
              <Box sx={{ pl: 4 }}>
                <List disablePadding>
                  {helpService.getArticlesByCategory(category.id).map((article) => (
                    <ListItem key={article.id} disablePadding>
                      <ListItemButton 
                        onClick={() => {
                          handleCategorySelect(category.id);
                          handleArticleSelect(article.id);
                        }}
                        selected={selectedArticle?.id === article.id}
                        sx={{ pl: 2 }}
                      >
                        <ListItemText 
                          primary={article.title}
                          primaryTypographyProps={{
                            variant: 'body2'
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </React.Fragment>
        ))}
      </List>
    );
  };
  
  // 記事一覧の表示
  const renderArticlesList = () => {
    if (!selectedCategory) {
      return null;
    }
    
    const category = categories.find(c => c.id === selectedCategory);
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {category?.name || '記事一覧'}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {category?.description}
        </Typography>
        
        <List>
          {articles.map((article) => (
            <ListItem 
              key={article.id} 
              disablePadding
              divider
            >
              <ListItemButton onClick={() => handleArticleSelect(article.id)}>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={article.title}
                  secondary={`最終更新: ${formatDistanceToNow(new Date(article.lastUpdated), { addSuffix: true, locale: ja })}`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };
  
  // 記事の表示
  const renderArticle = () => {
    if (!selectedArticle) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <HelpIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            記事を選択してください
          </Typography>
          <Typography variant="body2" color="text.secondary">
            閲覧したい記事を左側のパネルから選択してください
          </Typography>
        </Box>
      );
    }
    
    const isBookmarked = bookmarkedArticles.includes(selectedArticle.id);
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" component="h1">
            {selectedArticle.title}
          </Typography>
          <IconButton onClick={() => toggleBookmark(selectedArticle.id)}>
            {isBookmarked ? <BookmarkIcon color="primary" /> : <BookmarkBorderIcon />}
          </IconButton>
        </Box>
        
        {selectedArticle.videoUrl && (
          <Button
            startIcon={<VideoIcon />}
            variant="outlined"
            size="small"
            sx={{ mb: 3 }}
            onClick={() => window.open(selectedArticle.videoUrl, '_blank')}
          >
            チュートリアル動画を見る
          </Button>
        )}
        
        <Box sx={{ 
          mt: 2, 
          '& img': { 
            maxWidth: '100%',
            height: 'auto' 
          },
          '& h1': {
            fontSize: '1.7rem',
            fontWeight: 600,
            mt: 3,
            mb: 2
          },
          '& h2': {
            fontSize: '1.4rem',
            fontWeight: 600,
            mt: 3,
            mb: 2
          },
          '& h3': {
            fontSize: '1.2rem',
            fontWeight: 600,
            mt: 2,
            mb: 1
          },
          '& p': {
            mb: 2
          },
          '& ul, & ol': {
            pl: 2,
            mb: 2
          },
          '& li': {
            mb: 1
          },
          '& pre': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
            p: 2,
            borderRadius: 1,
            overflowX: 'auto',
            fontFamily: 'monospace'
          },
          '& code': {
            fontFamily: 'monospace',
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
            p: 0.5,
            borderRadius: 0.5
          }
        }}>
          <ReactMarkdown>
            {selectedArticle.content}
          </ReactMarkdown>
        </Box>
        
        <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedArticle.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            最終更新: {formatDistanceToNow(new Date(selectedArticle.lastUpdated), { addSuffix: true, locale: ja })}
          </Typography>
          
          <Button
            startIcon={<LinkIcon />}
            size="small"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('help', selectedArticle.id);
              navigator.clipboard.writeText(url.toString());
              // TODO: 成功通知を表示
            }}
          >
            リンクをコピー
          </Button>
        </Box>
        
        {relatedArticles.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
              関連記事
            </Typography>
            <Grid container spacing={2}>
              {relatedArticles.map((article) => (
                <Grid item xs={12} sm={6} key={article.id}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, cursor: 'pointer', height: '100%' }}
                    onClick={() => handleArticleSelect(article.id)}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      {article.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {article.content.substring(0, 100)}...
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    );
  };
  
  // モバイル表示の制御
  const getMobileContent = () => {
    if (showingMobileArticle && selectedArticle) {
      return (
        <>
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleMobileBack}
            >
              記事一覧に戻る
            </Button>
          </Box>
          {renderArticle()}
        </>
      );
    }
    
    if (showingMobileCategory) {
      return (
        <>
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleMobileBack}
            >
              カテゴリーに戻る
            </Button>
          </Box>
          {renderArticlesList()}
        </>
      );
    }
    
    if (searchQuery.length > 0) {
      return renderSearchResults();
    }
    
    return renderCategories();
  };
  
  const drawerWidth = fullWidth ? '100%' : 400;
  
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: [1, 2],
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <HelpIcon sx={{ mr: 1 }} />
          ヘルプセンター
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Toolbar>
      
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <form onSubmit={handleSearch}>
          <TextField
            fullWidth
            placeholder="ヘルプを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            size="small"
          />
        </form>
      </Box>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            ヘルプデータの読み込みに失敗しました: {error.message}
          </Alert>
        </Box>
      ) : isMobile ? (
        <Box sx={{ p: 2, overflow: 'auto' }}>
          {getMobileContent()}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', height: 'calc(100% - 128px)' }}>
          <Box
            sx={{
              width: 240,
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto'
            }}
          >
            {searchQuery.length > 0 ? renderSearchResults() : renderCategories()}
          </Box>
          
          <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
            {renderBreadcrumbs()}
            
            <Fade in={!selectedArticle && !!selectedCategory}>
              <Box sx={{ display: selectedArticle ? 'none' : 'block' }}>
                {renderArticlesList()}
              </Box>
            </Fade>
            
            <Fade in={!!selectedArticle}>
              <Box sx={{ display: !selectedArticle ? 'none' : 'block' }}>
                {renderArticle()}
              </Box>
            </Fade>
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

export default HelpCenter;