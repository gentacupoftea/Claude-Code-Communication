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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  Tooltip,
  Menu,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  CardMedia,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  useTheme,
  alpha
} from '@mui/material';
import {
  Inventory as ProductIcon,
  Inventory2 as InventoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  PhotoCamera as PhotoIcon,
  QrCode as QrCodeIcon,
  Category as CategoryIcon,
  Store as StoreIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  ShoppingCart as CartIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  LocalOffer as OfferIcon,
  Sync as SyncIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Product {
  id: string;
  sku: string;
  name: string;
  nameJa?: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  type: 'simple' | 'variable' | 'digital' | 'bundle';
  status: 'active' | 'inactive' | 'draft' | 'archived';
  visibility: 'public' | 'private' | 'hidden';
  featured: boolean;
  price: number;
  salePrice?: number;
  costPrice: number;
  compareAtPrice?: number;
  taxClass?: string;
  images: {
    id: string;
    url: string;
    alt: string;
    position: number;
  }[];
  inventory: {
    trackInventory: boolean;
    stockQuantity: number;
    lowStockThreshold: number;
    stockStatus: 'in_stock' | 'out_of_stock' | 'on_backorder';
    allowBackorders: boolean;
    locations: {
      locationId: string;
      quantity: number;
    }[];
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
    slug: string;
  };
  platforms: {
    platform: string;
    platformId?: string;
    status: 'active' | 'inactive' | 'pending';
    lastSync: Date;
  }[];
  tags: string[];
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  createdAt: Date;
  updatedAt: Date;
  analytics: {
    views: number;
    sales: number;
    revenue: number;
    conversionRate: number;
    averageRating: number;
    reviewCount: number;
    impressions: number;
    wishlistAdds: number;
    cartAdds: number;
    abandons: number;
  };
}

const ProductManagement: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDialog, setProductDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Mock data generation
  useEffect(() => {
    const mockProducts: Product[] = [
      {
        id: '1',
        sku: 'SHIRT-001',
        name: 'プレミアムコットンシャツ',
        description: '高品質なコットン100%のシャツです。',
        category: 'アパレル',
        subcategory: 'シャツ',
        brand: 'ConEA',
        type: 'simple',
        status: 'active',
        visibility: 'public',
        featured: true,
        price: 8900,
        salePrice: 7900,
        costPrice: 4500,
        compareAtPrice: 9900,
        images: [
          {
            id: '1',
            url: '/images/shirt1.jpg',
            alt: 'プレミアムコットンシャツ',
            position: 1
          }
        ],
        inventory: {
          trackInventory: true,
          stockQuantity: 45,
          lowStockThreshold: 10,
          stockStatus: 'in_stock',
          allowBackorders: false,
          locations: [
            { locationId: 'main', quantity: 45 }
          ]
        },
        seo: {
          title: 'プレミアムコットンシャツ - 高品質素材',
          description: 'コットン100%の快適なシャツ',
          slug: 'premium-cotton-shirt'
        },
        platforms: [
          { platform: 'shopify', status: 'active', lastSync: new Date() },
          { platform: 'rakuten', status: 'active', lastSync: new Date() }
        ],
        tags: ['シャツ', 'コットン', 'カジュアル'],
        weight: 200,
        dimensions: { length: 70, width: 50, height: 2 },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date(),
        analytics: {
          views: 1250,
          sales: 89,
          revenue: 703100,
          conversionRate: 7.1,
          averageRating: 4.5,
          reviewCount: 23,
          impressions: 5600,
          wishlistAdds: 156,
          cartAdds: 234,
          abandons: 67
        }
      },
      {
        id: '2',
        sku: 'SHOES-002',
        name: 'ランニングシューズ',
        description: '軽量で通気性の良いランニングシューズ',
        category: 'シューズ',
        subcategory: 'スポーツシューズ',
        brand: 'ConEA Sports',
        type: 'variable',
        status: 'active',
        visibility: 'public',
        featured: false,
        price: 12900,
        costPrice: 6500,
        images: [
          {
            id: '2',
            url: '/images/shoes1.jpg',
            alt: 'ランニングシューズ',
            position: 1
          }
        ],
        inventory: {
          trackInventory: true,
          stockQuantity: 23,
          lowStockThreshold: 5,
          stockStatus: 'in_stock',
          allowBackorders: true,
          locations: [
            { locationId: 'main', quantity: 23 }
          ]
        },
        seo: {
          title: 'ランニングシューズ - 軽量設計',
          description: '快適なランニング体験を提供するシューズ',
          slug: 'running-shoes'
        },
        platforms: [
          { platform: 'shopify', status: 'active', lastSync: new Date() },
          { platform: 'amazon', status: 'pending', lastSync: new Date() }
        ],
        tags: ['シューズ', 'ランニング', 'スポーツ'],
        weight: 350,
        dimensions: { length: 30, width: 15, height: 12 },
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date(),
        analytics: {
          views: 890,
          sales: 34,
          revenue: 438600,
          conversionRate: 3.8,
          averageRating: 4.2,
          reviewCount: 15,
          impressions: 3200,
          wishlistAdds: 98,
          cartAdds: 145,
          abandons: 23
        }
      }
    ];
    setProducts(mockProducts);
  }, []);

  const filteredProducts = products.filter(product => {
    return (
      (searchTerm === '' || 
       product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       product.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterCategory === 'all' || product.category === filterCategory) &&
      (filterStatus === 'all' || product.status === filterStatus) &&
      (filterPlatform === 'all' || product.platforms.some(p => p.platform === filterPlatform))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'draft': return 'warning';
      case 'archived': return 'error';
      default: return 'default';
    }
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'success';
      case 'out_of_stock': return 'error';
      case 'on_backorder': return 'warning';
      default: return 'default';
    }
  };

  const renderOverview = () => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === 'active').length;
    const totalValue = products.reduce((sum, p) => sum + (p.inventory.stockQuantity * p.costPrice), 0);
    const lowStockProducts = products.filter(p => 
      p.inventory.trackInventory && 
      p.inventory.stockQuantity <= p.inventory.lowStockThreshold
    ).length;
    const outOfStockProducts = products.filter(p => p.inventory.stockStatus === 'out_of_stock').length;

    return (
      <Grid container spacing={3}>
        {/* Overview Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              borderRadius: 3,
              p: 3,
              color: 'white',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <ProductIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                総商品数
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {totalProducts}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              アクティブ: {activeProducts}件
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
              borderRadius: 3,
              p: 3,
              color: 'white',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <MoneyIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                在庫価値
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              ¥{totalValue.toLocaleString()}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              原価ベース
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
              borderRadius: 3,
              p: 3,
              color: 'white',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <WarningIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                在庫少
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {lowStockProducts}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              要補充商品
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
              borderRadius: 3,
              p: 3,
              color: 'white',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 8px 12px -2px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <CancelIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                在庫切れ
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {outOfStockProducts}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              緊急対応必要
            </Typography>
          </Box>
        </Grid>
      </Grid>
    );
  };

  const renderProductsList = () => {
    return (
      <Box>
        {/* Search and Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="商品検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 250 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={filterCategory}
              label="カテゴリ"
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="アパレル">アパレル</MenuItem>
              <MenuItem value="シューズ">シューズ</MenuItem>
              <MenuItem value="エレクトロニクス">エレクトロニクス</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filterStatus}
              label="ステータス"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="active">アクティブ</MenuItem>
              <MenuItem value="inactive">非アクティブ</MenuItem>
              <MenuItem value="draft">下書き</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" startIcon={<AddIcon />}>
            商品追加
          </Button>
        </Box>

        {/* Products Table */}
        <TableContainer 
          component={Box}
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 3,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell sx={{ fontWeight: 600 }}>商品</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>カテゴリ</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">価格</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">在庫</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>ステータス</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>アクション</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {product.images.length > 0 ? (
                        <Avatar
                          src={product.images[0].url}
                          alt={product.images[0].alt}
                          variant="rounded"
                          sx={{ width: 50, height: 50 }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 50, height: 50, bgcolor: 'grey.300' }}>
                          <PhotoIcon />
                        </Avatar>
                      )}
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">{product.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{product.sku}</Typography>
                        {product.featured && <Chip label="注目" size="small" color="primary" sx={{ mt: 0.5 }} />}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{product.category}</Typography>
                    {product.subcategory && (
                      <Typography variant="caption" color="text.secondary">{product.subcategory}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ¥{product.price.toLocaleString()}
                    </Typography>
                    {product.salePrice && (
                      <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                        ¥{product.salePrice.toLocaleString()}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {product.inventory.stockQuantity}
                      </Typography>
                      <Chip 
                        label={product.inventory.stockStatus} 
                        color={getStockStatusColor(product.inventory.stockStatus) as any}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={product.status} 
                      color={getStatusColor(product.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        setSelectedProduct(product);
                        setAnchorEl(e.currentTarget);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredProducts.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ProductIcon color="primary" sx={{ fontSize: 40 }} />
        商品・在庫管理
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="概要" icon={<AssessmentIcon />} />
          <Tab label="商品一覧" icon={<ProductIcon />} />
          <Tab label="在庫管理" icon={<InventoryIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderOverview()}
      {activeTab === 1 && renderProductsList()}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setProductDialog(true);
          setAnchorEl(null);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ViewIcon sx={{ mr: 1 }} />
          詳細表示
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <SyncIcon sx={{ mr: 1 }} />
          プラットフォーム同期
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProductManagement;