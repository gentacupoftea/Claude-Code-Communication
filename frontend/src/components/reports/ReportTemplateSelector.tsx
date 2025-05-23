/**
 * レポートテンプレートセレクターコンポーネント
 * 
 * 利用可能なレポートテンプレートを表示して選択するためのコンポーネント
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Rating,
  Tooltip,
  IconButton,
  CircularProgress,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Description,
  Schedule,
  LocalOffer,
  Star,
  TrendingUp,
  Inventory,
  People,
  Language,
  Storefront,
  Timeline,
  CalendarToday,
  Favorite,
  FavoriteBorder,
  Add,
  Info,
  Search,
  FilterList,
  Settings,
} from '@mui/icons-material';

// レポートカテゴリータイプ
type ReportCategory = 
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'seo'
  | 'marketing'
  | 'financial'
  | 'operations'
  | 'marketplace'
  | 'custom';

// レポートフォーマット
type ReportFormat = 'pdf' | 'excel' | 'csv' | 'googleSheet' | 'web';

// レポートの詳細度レベル
type DetailLevel = 'summary' | 'standard' | 'detailed' | 'advanced';

// レポートテンプレート
interface ReportTemplate {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  format: ReportFormat[];
  thumbnail: string;
  popular: boolean;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  lastUpdated: Date;
  detailLevel: DetailLevel[];
  platforms: string[];
  customizable: boolean;
  schedulable: boolean;
  metrics: string[];
  chartsCount: number;
  tablesCount: number;
  author: 'system' | 'user';
  sampleUrl?: string;
}

interface ReportTemplateSelectorProps {
  onSelect: (template: ReportTemplate) => void;
  selectedTemplateId?: string;
  showFilters?: boolean;
  initialCategory?: ReportCategory;
  showSearch?: boolean;
  showCategories?: boolean;
  className?: string;
}

const ReportTemplateSelector: React.FC<ReportTemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  showFilters = true,
  initialCategory,
  showSearch = true,
  showCategories = true,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>(initialCategory || 'all');
  const [detailView, setDetailView] = useState<ReportTemplate | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // サンプルレポートテンプレートデータ
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'sales-monthly',
      name: '月次売上レポート',
      category: 'sales',
      description: '月間の売上、注文、顧客に関する詳細な分析レポートです。トレンド、製品カテゴリ、地域別の分析が含まれます。',
      format: ['pdf', 'excel', 'csv', 'web'],
      thumbnail: '/reports/monthly-sales.png',
      popular: true,
      rating: 4.8,
      ratingCount: 245,
      createdAt: new Date('2023-01-15'),
      lastUpdated: new Date('2023-12-05'),
      detailLevel: ['summary', 'standard', 'detailed'],
      platforms: ['shopify', 'rakuten', 'amazon'],
      customizable: true,
      schedulable: true,
      metrics: ['売上', '注文数', '平均注文額', 'コンバージョン率'],
      chartsCount: 8,
      tablesCount: 5,
      author: 'system',
      sampleUrl: '/reports/samples/monthly-sales.pdf'
    },
    {
      id: 'inventory-stock',
      name: '在庫分析レポート',
      category: 'inventory',
      description: '在庫レベル、回転率、売れ筋商品、在庫切れリスクに関する詳細な分析を提供します。',
      format: ['pdf', 'excel', 'csv'],
      thumbnail: '/reports/inventory-analysis.png',
      popular: true,
      rating: 4.5,
      ratingCount: 187,
      createdAt: new Date('2023-02-10'),
      lastUpdated: new Date('2023-11-20'),
      detailLevel: ['standard', 'detailed'],
      platforms: ['shopify', 'rakuten'],
      customizable: true,
      schedulable: true,
      metrics: ['在庫レベル', '回転率', '在庫日数', '売れ筋商品'],
      chartsCount: 6,
      tablesCount: 4,
      author: 'system'
    },
    {
      id: 'customer-cohort',
      name: '顧客コホート分析',
      category: 'customers',
      description: '顧客セグメント、リテンション率、生涯価値（LTV）に関する詳細な分析を提供します。',
      format: ['pdf', 'excel', 'web'],
      thumbnail: '/reports/customer-cohort.png',
      popular: false,
      rating: 4.7,
      ratingCount: 132,
      createdAt: new Date('2023-03-05'),
      lastUpdated: new Date('2023-10-15'),
      detailLevel: ['standard', 'detailed', 'advanced'],
      platforms: ['shopify'],
      customizable: true,
      schedulable: true,
      metrics: ['顧客生涯価値', 'リテンション率', '再購入率', '平均購入間隔'],
      chartsCount: 10,
      tablesCount: 6,
      author: 'system'
    },
    {
      id: 'seo-performance',
      name: 'SEOパフォーマンスレポート',
      category: 'seo',
      description: '検索エンジンでのパフォーマンス、キーワードランキング、サイト訪問データの詳細な分析を提供します。',
      format: ['pdf', 'excel', 'web'],
      thumbnail: '/reports/seo-performance.png',
      popular: false,
      rating: 4.3,
      ratingCount: 98,
      createdAt: new Date('2023-04-20'),
      lastUpdated: new Date('2023-09-10'),
      detailLevel: ['summary', 'detailed'],
      platforms: ['shopify'],
      customizable: true,
      schedulable: true,
      metrics: ['検索ランキング', 'クリック率', 'コンバージョン率', 'バウンス率'],
      chartsCount: 7,
      tablesCount: 4,
      author: 'system'
    },
    {
      id: 'marketplace-comparison',
      name: 'マーケットプレイス比較レポート',
      category: 'marketplace',
      description: '複数のマーケットプレイスにおける売上、コンバージョン、利益率を比較分析します。',
      format: ['pdf', 'excel'],
      thumbnail: '/reports/marketplace-comparison.png',
      popular: true,
      rating: 4.6,
      ratingCount: 156,
      createdAt: new Date('2023-05-15'),
      lastUpdated: new Date('2023-12-01'),
      detailLevel: ['summary', 'standard', 'detailed'],
      platforms: ['shopify', 'rakuten', 'amazon'],
      customizable: true,
      schedulable: true,
      metrics: ['チャネル別売上', '利益率', '手数料', 'マーケットシェア'],
      chartsCount: 9,
      tablesCount: 6,
      author: 'system'
    },
    {
      id: 'financial-summary',
      name: '財務サマリーレポート',
      category: 'financial',
      description: '売上、費用、利益、キャッシュフローに関する財務データを集約した月次レポートです。',
      format: ['pdf', 'excel'],
      thumbnail: '/reports/financial-summary.png',
      popular: false,
      rating: 4.4,
      ratingCount: 112,
      createdAt: new Date('2023-06-10'),
      lastUpdated: new Date('2023-11-10'),
      detailLevel: ['summary', 'detailed'],
      platforms: ['shopify', 'rakuten', 'amazon'],
      customizable: true,
      schedulable: true,
      metrics: ['売上', '費用', '粗利益', '純利益'],
      chartsCount: 5,
      tablesCount: 8,
      author: 'system'
    },
    {
      id: 'marketing-campaign',
      name: 'マーケティングキャンペーン分析',
      category: 'marketing',
      description: 'マーケティングキャンペーンのパフォーマンス、ROI、コンバージョンに関する詳細な分析を提供します。',
      format: ['pdf', 'excel', 'web'],
      thumbnail: '/reports/marketing-campaign.png',
      popular: false,
      rating: 4.2,
      ratingCount: 87,
      createdAt: new Date('2023-07-05'),
      lastUpdated: new Date('2023-10-25'),
      detailLevel: ['standard', 'detailed'],
      platforms: ['shopify'],
      customizable: true,
      schedulable: true,
      metrics: ['広告費用', 'ROAS', 'CPA', 'コンバージョン率'],
      chartsCount: 6,
      tablesCount: 3,
      author: 'system'
    },
    {
      id: 'custom-sales-report',
      name: 'カスタム売上レポート',
      category: 'custom',
      description: 'ユーザーによってカスタマイズされた売上分析レポートです。',
      format: ['pdf', 'excel'],
      thumbnail: '/reports/custom-report.png',
      popular: false,
      rating: 4.0,
      ratingCount: 23,
      createdAt: new Date('2023-08-15'),
      lastUpdated: new Date('2023-12-10'),
      detailLevel: ['standard'],
      platforms: ['shopify', 'rakuten'],
      customizable: false,
      schedulable: true,
      metrics: ['売上', '利益', '在庫回転率'],
      chartsCount: 4,
      tablesCount: 2,
      author: 'user'
    }
  ];
  
  // カテゴリーアイコンマップ
  const categoryIconMap: Record<ReportCategory | 'all', React.ReactElement | undefined> = {
    all: <Description />,
    sales: <TrendingUp />,
    inventory: <Inventory />,
    customers: <People />,
    seo: <Language />,
    marketing: <LocalOffer />,
    financial: <Description />,
    operations: <Timeline />,
    marketplace: <Storefront />,
    custom: <Settings />,
  };
  
  // フィルタリングされたテンプレート
  const filteredTemplates = reportTemplates.filter((template) => {
    // 検索フィルター
    const searchMatch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // カテゴリーフィルター
    const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory;
    
    return searchMatch && categoryMatch;
  });
  
  // お気に入りトグル
  const toggleFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setFavorites((prevFavorites) => {
      if (prevFavorites.includes(id)) {
        return prevFavorites.filter((favId) => favId !== id);
      } else {
        return [...prevFavorites, id];
      }
    });
  };
  
  // テンプレート選択ハンドラー
  const handleSelectTemplate = (template: ReportTemplate) => {
    onSelect(template);
  };
  
  // タブ変更ハンドラー
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // カテゴリー選択UI
  const renderCategorySelector = () => {
    const categories: Array<ReportCategory | 'all'> = [
      'all', 'sales', 'inventory', 'customers', 'marketing', 'seo', 'financial', 'marketplace', 'custom'
    ];
    
    return (
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {categories.map((category) => (
          <Chip
            key={category}
            label={category === 'all' ? 'すべて' : category}
            icon={categoryIconMap[category]}
            onClick={() => setSelectedCategory(category)}
            color={selectedCategory === category ? 'primary' : 'default'}
            variant={selectedCategory === category ? 'filled' : 'outlined'}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Box>
    );
  };
  
  // 詳細ダイアログ
  const renderDetailDialog = () => {
    if (!detailView) return null;
    
    return (
      <Dialog
        open={!!detailView}
        onClose={() => setDetailView(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {detailView.name}
          <Chip
            label={detailView.category}
            size="small"
            color="primary"
            sx={{ ml: 1, textTransform: 'capitalize' }}
          />
        </DialogTitle>
        
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  height: 250,
                  bgcolor: 'grey.200',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  レポートプレビュー
                </Typography>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>説明</Typography>
              <Typography variant="body2" paragraph>
                {detailView.description}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>メトリクス</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {detailView.metrics.map((metric) => (
                    <Chip key={metric} label={metric} size="small" />
                  ))}
                </Box>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>対応プラットフォーム</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {detailView.platforms.map((platform) => (
                    <Chip key={platform} label={platform} size="small" />
                  ))}
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={5}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Schedule fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="最終更新"
                    secondary={detailView.lastUpdated.toLocaleDateString()}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Star fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="評価"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Rating
                          value={detailView.rating}
                          precision={0.5}
                          size="small"
                          readOnly
                        />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          ({detailView.ratingCount})
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Description fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="レポート内容"
                    secondary={`グラフ ${detailView.chartsCount}個、テーブル ${detailView.tablesCount}個`}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <LocalOffer fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="対応フォーマット"
                    secondary={detailView.format.join(', ')}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Settings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="カスタマイズ"
                    secondary={detailView.customizable ? '可能' : '不可'}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="スケジュール設定"
                    secondary={detailView.schedulable ? '可能' : '不可'}
                  />
                </ListItem>
              </List>
              
              {detailView.sampleUrl && (
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2 }}
                  startIcon={<Description />}
                >
                  サンプルを表示
                </Button>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDetailView(null)}>
            閉じる
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              handleSelectTemplate(detailView);
              setDetailView(null);
            }}
            startIcon={<Description />}
          >
            このテンプレートを使用
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Box className={className}>
      {showSearch && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            placeholder="レポートを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />,
            }}
          />
          
          <Tooltip title="詳細フィルター">
            <IconButton>
              <FilterList />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      
      {showCategories && renderCategorySelector()}
      
      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="すべてのレポート" />
          <Tab label="おすすめ" />
          <Tab label="お気に入り" />
          <Tab label="最近使用" />
        </Tabs>
      </Box>
      
      <Grid container spacing={3}>
        {filteredTemplates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card 
              sx={{ 
                height: '100%',
                border: selectedTemplateId === template.id ? '2px solid' : '1px solid',
                borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider',
              }}
            >
              <CardActionArea
                onClick={() => setDetailView(template)}
                sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
              >
                <Box
                  sx={{
                    height: 160,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    レポートサムネイル
                  </Typography>
                  
                  <IconButton
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                    }}
                    onClick={(e) => toggleFavorite(template.id, e)}
                  >
                    {favorites.includes(template.id) ? (
                      <Favorite color="error" />
                    ) : (
                      <FavoriteBorder />
                    )}
                  </IconButton>
                </Box>
                
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" noWrap sx={{ flexGrow: 1 }}>
                      {template.name}
                    </Typography>
                    
                    {template.popular && (
                      <Chip
                        label="人気"
                        size="small"
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      mb: 2,
                    }}
                  >
                    {template.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Chip
                      icon={categoryIconMap[template.category]}
                      label={template.category}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                      variant="outlined"
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Rating value={template.rating} precision={0.5} size="small" readOnly />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                        ({template.ratingCount})
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        
        {/* 新規テンプレート作成カード */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: '100%', border: '1px dashed', borderColor: 'divider' }}>
            <CardActionArea
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
              }}
            >
              <Add sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="subtitle1" align="center" gutterBottom>
                カスタムテンプレート作成
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                独自のレポートテンプレートを作成します
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
      
      {/* 詳細ダイアログ */}
      {renderDetailDialog()}
    </Box>
  );
};

export default ReportTemplateSelector;