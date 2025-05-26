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
  Stepper,
  Step,
  StepLabel,
  StepContent,
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
  useTheme,
  alpha,
} from '@mui/material';
// Date picker functionality temporarily removed due to dependency conflicts
import {
  Campaign as CampaignIcon,
  LocalOffer as OfferIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Percent as PercentIcon,
  People as PeopleIcon,
  ShoppingCart as CartIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  MoreVert as MoreVertIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Promotion {
  id: string;
  name: string;
  type: 'discount_percent' | 'discount_amount' | 'buy_x_get_y' | 'free_shipping' | 'bundle';
  code?: string;
  description: string;
  discountPercent?: number;
  discountAmount?: number;
  minimumOrderAmount?: number;
  maxUsage?: number;
  currentUsage: number;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'ended';
  platforms: string[];
  targetCustomers: 'all' | 'new' | 'vip' | 'custom';
  customerSegments?: string[];
  products?: string[];
  categories?: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  analytics: PromotionAnalytics;
}

interface PromotionAnalytics {
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  clickThroughRate: number;
  usageCount: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'seasonal' | 'flash_sale' | 'clearance' | 'new_product' | 'loyalty';
  startDate: Date;
  endDate: Date;
  budget: number;
  spentBudget: number;
  targetRevenue: number;
  actualRevenue: number;
  status: 'planning' | 'active' | 'paused' | 'completed';
  promotions: string[];
  channels: string[];
  analytics: CampaignAnalytics;
}

interface CampaignAnalytics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  cac: number; // Customer Acquisition Cost
  ltv: number; // Lifetime Value
}

const PromotionManagement: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [promotionDialog, setPromotionDialog] = useState(false);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  // Mock data generation
  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    const mockPromotions: Promotion[] = [
      {
        id: '1',
        name: '春の新商品セール',
        type: 'discount_percent',
        code: 'SPRING2024',
        description: '全ての春商品が20%オフ',
        discountPercent: 20,
        minimumOrderAmount: 5000,
        maxUsage: 1000,
        currentUsage: 234,
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-04-30'),
        status: 'active',
        platforms: ['Shopify', 'Rakuten'],
        targetCustomers: 'all',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        analytics: {
          views: 15420,
          clicks: 2341,
          conversions: 234,
          revenue: 1250000,
          conversionRate: 10.0,
          averageOrderValue: 5341,
          clickThroughRate: 15.2,
          usageCount: 234
        }
      },
      {
        id: '2',
        name: 'VIP限定特別割引',
        type: 'discount_amount',
        code: 'VIP500',
        description: 'VIP会員限定 500円引き',
        discountAmount: 500,
        minimumOrderAmount: 3000,
        maxUsage: 500,
        currentUsage: 89,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'active',
        platforms: ['Shopify', 'Amazon'],
        targetCustomers: 'vip',
        priority: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        analytics: {
          views: 2340,
          clicks: 456,
          conversions: 89,
          revenue: 445000,
          conversionRate: 19.5,
          averageOrderValue: 5000,
          clickThroughRate: 19.5,
          usageCount: 89
        }
      },
      {
        id: '3',
        name: 'フラッシュセール',
        type: 'discount_percent',
        code: 'FLASH48H',
        description: '48時間限定 30%オフ',
        discountPercent: 30,
        minimumOrderAmount: 0,
        maxUsage: 200,
        currentUsage: 187,
        startDate: new Date('2024-03-15'),
        endDate: new Date('2024-03-17'),
        status: 'active',
        platforms: ['Shopify'],
        targetCustomers: 'all',
        priority: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        analytics: {
          views: 8760,
          clicks: 1254,
          conversions: 187,
          revenue: 890000,
          conversionRate: 14.9,
          averageOrderValue: 4759,
          clickThroughRate: 14.3,
          usageCount: 187
        }
      }
    ];

    const mockCampaigns: Campaign[] = [
      {
        id: '1',
        name: '春の大キャンペーン',
        description: '春商品の売上向上を目的とした総合キャンペーン',
        type: 'seasonal',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-05-31'),
        budget: 500000,
        spentBudget: 234000,
        targetRevenue: 5000000,
        actualRevenue: 2580000,
        status: 'active',
        promotions: ['1', '3'],
        channels: ['Web', 'SNS', 'Email'],
        analytics: {
          impressions: 450000,
          clicks: 23400,
          conversions: 1200,
          revenue: 2580000,
          roi: 11.03,
          cac: 195,
          ltv: 12500
        }
      },
      {
        id: '2',
        name: 'ロイヤルカスタマー強化',
        description: 'VIP顧客のエンゲージメント向上',
        type: 'loyalty',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        budget: 300000,
        spentBudget: 67000,
        targetRevenue: 2000000,
        actualRevenue: 445000,
        status: 'active',
        promotions: ['2'],
        channels: ['Email', 'App'],
        analytics: {
          impressions: 15000,
          clicks: 2340,
          conversions: 89,
          revenue: 445000,
          roi: 6.64,
          cac: 753,
          ltv: 25000
        }
      }
    ];

    setPromotions(mockPromotions);
    setCampaigns(mockCampaigns);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'default';
      case 'paused': return 'warning';
      case 'expired': return 'error';
      case 'ended': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'draft': return '下書き';
      case 'paused': return '一時停止';
      case 'expired': return '期限切れ';
      case 'ended': return '終了';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'discount_percent': return 'パーセント割引';
      case 'discount_amount': return '金額割引';
      case 'buy_x_get_y': return 'まとめ買い割引';
      case 'free_shipping': return '送料無料';
      case 'bundle': return 'バンドル割引';
      default: return type;
    }
  };

  const filteredPromotions = promotions.filter(promo => {
    const matchesSearch = promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         promo.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || promo.status === filterStatus;
    const matchesType = filterType === 'all' || promo.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const renderOverview = () => {
    const totalPromotions = promotions.length;
    const activePromotions = promotions.filter(p => p.status === 'active').length;
    const totalRevenue = promotions.reduce((sum, p) => sum + p.analytics.revenue, 0);
    const totalConversions = promotions.reduce((sum, p) => sum + p.analytics.conversions, 0);

    const revenueData = promotions.slice(0, 5).map(p => ({
      name: p.name.substring(0, 10) + '...',
      revenue: p.analytics.revenue,
      conversions: p.analytics.conversions
    }));

    const performanceData = [
      { month: '1月', revenue: 1200000, conversions: 340 },
      { month: '2月', revenue: 1580000, conversions: 420 },
      { month: '3月', revenue: 2140000, conversions: 580 },
      { month: '4月', revenue: 1890000, conversions: 510 },
      { month: '5月', revenue: 2340000, conversions: 650 }
    ];

    return (
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{totalPromotions}</Typography>
                  <Typography variant="body2">総プロモーション数</Typography>
                </Box>
                <CampaignIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{activePromotions}</Typography>
                  <Typography variant="body2">アクティブ</Typography>
                </Box>
                <PlayIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">¥{totalRevenue.toLocaleString()}</Typography>
                  <Typography variant="body2">総売上</Typography>
                </Box>
                <MoneyIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{totalConversions}</Typography>
                  <Typography variant="body2">総コンバージョン</Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>プロモーション別売上</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="revenue" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>月次パフォーマンス推移</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Promotions Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>アクティブプロモーション</Typography>
              <Grid container spacing={2}>
                {promotions.filter(p => p.status === 'active').map(promo => (
                  <Grid item xs={12} md={4} key={promo.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography variant="h6">{promo.name}</Typography>
                          <Chip 
                            label={`${promo.currentUsage}/${promo.maxUsage}`} 
                            size="small" 
                            color={promo.currentUsage > (promo.maxUsage || 0) * 0.8 ? 'warning' : 'primary'}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {promo.description}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            売上: ¥{promo.analytics.revenue.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">
                            CVR: {promo.analytics.conversionRate}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={(promo.currentUsage / (promo.maxUsage || 1)) * 100}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderPromotionsList = () => (
    <Card>
      <CardContent>
        {/* Search and Filter Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="プロモーション名またはコードで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 300 }}
          />
          
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filterStatus}
              label="ステータス"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="active">アクティブ</MenuItem>
              <MenuItem value="draft">下書き</MenuItem>
              <MenuItem value="paused">一時停止</MenuItem>
              <MenuItem value="expired">期限切れ</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>タイプ</InputLabel>
            <Select
              value={filterType}
              label="タイプ"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="discount_percent">パーセント割引</MenuItem>
              <MenuItem value="discount_amount">金額割引</MenuItem>
              <MenuItem value="buy_x_get_y">まとめ買い</MenuItem>
              <MenuItem value="free_shipping">送料無料</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setPromotionDialog(true)}
          >
            プロモーション作成
          </Button>

          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
          >
            エクスポート
          </Button>
        </Box>

        {/* Promotions Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell>プロモーション情報</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>期間</TableCell>
                <TableCell align="right">使用率</TableCell>
                <TableCell align="right">売上</TableCell>
                <TableCell align="right">CVR</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPromotions
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((promo) => (
                <TableRow key={promo.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">{promo.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{promo.code}</Typography>
                      <Typography variant="caption" color="text.secondary">{promo.description}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={getTypeLabel(promo.type)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {promo.startDate.toLocaleDateString()} - {promo.endDate.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {promo.currentUsage}/{promo.maxUsage}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(promo.currentUsage / (promo.maxUsage || 1)) * 100}
                        sx={{ width: 80 }}
                        color={promo.currentUsage > (promo.maxUsage || 0) * 0.8 ? 'warning' : 'primary'}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ¥{promo.analytics.revenue.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {promo.analytics.conversionRate}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(promo.status)} 
                      color={getStatusColor(promo.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        setSelectedPromotion(promo);
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
          count={filteredPromotions.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </CardContent>
    </Card>
  );

  const renderCampaigns = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">キャンペーン管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCampaignDialog(true)}
          >
            キャンペーン作成
          </Button>
        </Box>

        <Grid container spacing={3}>
          {campaigns.map(campaign => (
            <Grid item xs={12} md={6} key={campaign.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">{campaign.name}</Typography>
                    <Chip 
                      label={campaign.status} 
                      color={getStatusColor(campaign.status) as any}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {campaign.description}
                  </Typography>

                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">予算</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          ¥{campaign.spentBudget.toLocaleString()} / ¥{campaign.budget.toLocaleString()}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={(campaign.spentBudget / campaign.budget) * 100}
                          sx={{ mt: 0.5 }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">売上目標</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          ¥{campaign.actualRevenue.toLocaleString()} / ¥{campaign.targetRevenue.toLocaleString()}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={(campaign.actualRevenue / campaign.targetRevenue) * 100}
                          sx={{ mt: 0.5 }}
                          color="success"
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Chip label={`ROI: ${campaign.analytics.roi}%`} size="small" />
                    <Chip label={`CV: ${campaign.analytics.conversions}`} size="small" />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<EditIcon />}>編集</Button>
                  <Button size="small" startIcon={<AssessmentIcon />}>詳細</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAnalytics = () => {
    const conversionData = [
      { name: '月', impressions: 125000, clicks: 5400, conversions: 540 },
      { name: '火', impressions: 98000, clicks: 4200, conversions: 420 },
      { name: '水', impressions: 112000, clicks: 4800, conversions: 480 },
      { name: '木', impressions: 134000, clicks: 5700, conversions: 570 },
      { name: '金', impressions: 156000, clicks: 6800, conversions: 680 },
      { name: '土', impressions: 189000, clicks: 8200, conversions: 820 },
      { name: '日', impressions: 167000, clicks: 7300, conversions: 730 }
    ];

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>週次コンバージョンファネル</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="impressions" stackId="1" stroke="#8884d8" fill="#8884d8" />
                  <Area type="monotone" dataKey="clicks" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                  <Area type="monotone" dataKey="conversions" stackId="3" stroke="#ffc658" fill="#ffc658" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CampaignIcon color="primary" sx={{ fontSize: 40 }} />
        プロモーション・キャンペーン管理
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="概要" icon={<AssessmentIcon />} />
          <Tab label="プロモーション" icon={<OfferIcon />} />
          <Tab label="キャンペーン" icon={<CampaignIcon />} />
          <Tab label="分析" icon={<TrendingUpIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderOverview()}
      {activeTab === 1 && renderPromotionsList()}
      {activeTab === 2 && renderCampaigns()}
      {activeTab === 3 && renderAnalytics()}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setPromotionDialog(true);
          setAnchorEl(null);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <CopyIcon sx={{ mr: 1 }} />
          複製
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ShareIcon sx={{ mr: 1 }} />
          共有
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <PauseIcon sx={{ mr: 1 }} />
          一時停止
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default PromotionManagement;