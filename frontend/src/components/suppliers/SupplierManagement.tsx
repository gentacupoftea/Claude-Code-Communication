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
  Rating,
  useTheme,
  alpha
} from '@mui/material';
import {
  Business as BusinessIcon,
  ContactPhone as ContactIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  LocalShipping as ShippingIcon,
  Assessment as AssessmentIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface Supplier {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  businessType: 'manufacturer' | 'wholesaler' | 'distributor' | 'dropshipper';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  rating: number;
  totalOrders: number;
  totalValue: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  defectRate: number;
  paymentTerms: string;
  currency: string;
  minimumOrder: number;
  leadTime: number;
  products: string[];
  categories: string[];
  certifications: string[];
  contractStartDate: Date;
  contractEndDate?: Date;
  lastOrderDate?: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  performance: SupplierPerformance;
}

interface SupplierPerformance {
  qualityScore: number;
  deliveryScore: number;
  communicationScore: number;
  priceCompetitiveness: number;
  overallScore: number;
  monthlyOrders: number;
  monthlyValue: number;
  returnRate: number;
  responseTime: number; // hours
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  orderDate: Date;
  expectedDelivery: Date;
  actualDelivery?: Date;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  currency: string;
  items: OrderItem[];
}

interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const SupplierManagement: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [orderDialog, setOrderDialog] = useState(false);
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
    const mockSuppliers: Supplier[] = [
      {
        id: '1',
        name: '山田商事',
        companyName: '株式会社山田商事',
        contactPerson: '山田太郎',
        email: 'yamada@yamada-trading.co.jp',
        phone: '03-1234-5678',
        address: {
          street: '東京都渋谷区渋谷1-1-1',
          city: '渋谷区',
          state: '東京都',
          zipCode: '150-0002',
          country: '日本'
        },
        businessType: 'wholesaler',
        status: 'active',
        rating: 4.5,
        totalOrders: 245,
        totalValue: 12500000,
        averageDeliveryTime: 3.2,
        onTimeDeliveryRate: 94.5,
        defectRate: 0.8,
        paymentTerms: '月末締翌月末払い',
        currency: 'JPY',
        minimumOrder: 100000,
        leadTime: 7,
        products: ['PRD001', 'PRD002', 'PRD003'],
        categories: ['アパレル', 'アクセサリー'],
        certifications: ['ISO9001', 'ISO14001'],
        contractStartDate: new Date('2023-01-01'),
        contractEndDate: new Date('2024-12-31'),
        lastOrderDate: new Date('2024-03-15'),
        notes: '品質安定、納期遵守率高い',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date(),
        performance: {
          qualityScore: 92,
          deliveryScore: 95,
          communicationScore: 88,
          priceCompetitiveness: 85,
          overallScore: 90,
          monthlyOrders: 20,
          monthlyValue: 1250000,
          returnRate: 0.5,
          responseTime: 2.5
        }
      },
      {
        id: '2',
        name: 'グローバルサプライ',
        companyName: 'Global Supply International',
        contactPerson: 'John Smith',
        email: 'john@globalsupply.com',
        phone: '+1-555-0123',
        address: {
          street: '123 Business St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        businessType: 'manufacturer',
        status: 'active',
        rating: 4.2,
        totalOrders: 89,
        totalValue: 8750000,
        averageDeliveryTime: 12.5,
        onTimeDeliveryRate: 89.2,
        defectRate: 1.2,
        paymentTerms: 'Net 30',
        currency: 'USD',
        minimumOrder: 500,
        leadTime: 21,
        products: ['PRD004', 'PRD005'],
        categories: ['エレクトロニクス'],
        certifications: ['CE', 'FCC', 'RoHS'],
        contractStartDate: new Date('2023-06-01'),
        contractEndDate: new Date('2025-05-31'),
        lastOrderDate: new Date('2024-03-10'),
        notes: '海外製造、コストパフォーマンス良好',
        createdAt: new Date('2023-06-01'),
        updatedAt: new Date(),
        performance: {
          qualityScore: 88,
          deliveryScore: 85,
          communicationScore: 82,
          priceCompetitiveness: 95,
          overallScore: 87,
          monthlyOrders: 8,
          monthlyValue: 875000,
          returnRate: 1.0,
          responseTime: 6.0
        }
      },
      {
        id: '3',
        name: '関西物産',
        companyName: '関西物産株式会社',
        contactPerson: '田中花子',
        email: 'tanaka@kansai-bussan.co.jp',
        phone: '06-9876-5432',
        address: {
          street: '大阪府大阪市中央区大手前1-1-1',
          city: '大阪市',
          state: '大阪府',
          zipCode: '540-0008',
          country: '日本'
        },
        businessType: 'distributor',
        status: 'pending',
        rating: 0,
        totalOrders: 0,
        totalValue: 0,
        averageDeliveryTime: 0,
        onTimeDeliveryRate: 0,
        defectRate: 0,
        paymentTerms: '月末締翌々月10日払い',
        currency: 'JPY',
        minimumOrder: 50000,
        leadTime: 5,
        products: [],
        categories: ['食品', '日用品'],
        certifications: ['HACCP', 'JAS'],
        contractStartDate: new Date('2024-04-01'),
        notes: '新規取引先候補',
        createdAt: new Date(),
        updatedAt: new Date(),
        performance: {
          qualityScore: 0,
          deliveryScore: 0,
          communicationScore: 0,
          priceCompetitiveness: 0,
          overallScore: 0,
          monthlyOrders: 0,
          monthlyValue: 0,
          returnRate: 0,
          responseTime: 0
        }
      }
    ];

    const mockOrders: PurchaseOrder[] = [
      {
        id: '1',
        supplierId: '1',
        orderNumber: 'PO-2024-001',
        orderDate: new Date('2024-03-01'),
        expectedDelivery: new Date('2024-03-08'),
        actualDelivery: new Date('2024-03-07'),
        status: 'delivered',
        totalAmount: 450000,
        currency: 'JPY',
        items: [
          {
            productId: 'PRD001',
            productName: 'Tシャツ',
            sku: 'TSH-001',
            quantity: 100,
            unitPrice: 1200,
            totalPrice: 120000
          }
        ]
      }
    ];

    setSuppliers(mockSuppliers);
    setPurchaseOrders(mockOrders);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'inactive': return '非アクティブ';
      case 'pending': return '承認待ち';
      case 'suspended': return '取引停止';
      default: return status;
    }
  };

  const getBusinessTypeLabel = (type: string) => {
    switch (type) {
      case 'manufacturer': return 'メーカー';
      case 'wholesaler': return '卸売業者';
      case 'distributor': return '代理店';
      case 'dropshipper': return 'ドロップシッパー';
      default: return type;
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || supplier.status === filterStatus;
    const matchesType = filterType === 'all' || supplier.businessType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const renderOverview = () => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
    const totalValue = suppliers.reduce((sum, s) => sum + s.totalValue, 0);
    const averageRating = suppliers.filter(s => s.rating > 0).reduce((sum, s) => sum + s.rating, 0) / suppliers.filter(s => s.rating > 0).length;

    const performanceData = suppliers.filter(s => s.status === 'active').map(s => ({
      name: s.name.substring(0, 8) + '...',
      quality: s.performance.qualityScore,
      delivery: s.performance.deliveryScore,
      communication: s.performance.communicationScore,
      price: s.performance.priceCompetitiveness
    }));

    const categoryData = [
      { name: 'アパレル', value: 35, color: '#8884d8' },
      { name: 'エレクトロニクス', value: 28, color: '#82ca9d' },
      { name: '食品', value: 20, color: '#ffc658' },
      { name: '日用品', value: 17, color: '#ff7300' }
    ];

    const monthlyData = [
      { month: '1月', orders: 45, value: 2400000 },
      { month: '2月', orders: 52, value: 2800000 },
      { month: '3月', orders: 48, value: 2600000 },
      { month: '4月', orders: 61, value: 3200000 },
      { month: '5月', orders: 55, value: 2900000 }
    ];

    return (
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{totalSuppliers}</Typography>
                  <Typography variant="body2">総サプライヤー数</Typography>
                </Box>
                <BusinessIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{activeSuppliers}</Typography>
                  <Typography variant="body2">アクティブ</Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">¥{totalValue.toLocaleString()}</Typography>
                  <Typography variant="body2">総取引額</Typography>
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
                  <Typography variant="h4" fontWeight="bold">{averageRating.toFixed(1)}</Typography>
                  <Typography variant="body2">平均評価</Typography>
                </Box>
                <StarIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>サプライヤー別パフォーマンス</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="quality" fill="#8884d8" name="品質" />
                  <Bar dataKey="delivery" fill="#82ca9d" name="納期" />
                  <Bar dataKey="communication" fill="#ffc658" name="コミュニケーション" />
                  <Bar dataKey="price" fill="#ff7300" name="価格競争力" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>カテゴリ別分布</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>月次取引実績</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="value" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderSuppliersList = () => (
    <Card>
      <CardContent>
        {/* Search and Filter Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="サプライヤー名または会社名で検索..."
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
              <MenuItem value="inactive">非アクティブ</MenuItem>
              <MenuItem value="pending">承認待ち</MenuItem>
              <MenuItem value="suspended">取引停止</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>業種タイプ</InputLabel>
            <Select
              value={filterType}
              label="業種タイプ"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="manufacturer">メーカー</MenuItem>
              <MenuItem value="wholesaler">卸売業者</MenuItem>
              <MenuItem value="distributor">代理店</MenuItem>
              <MenuItem value="dropshipper">ドロップシッパー</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setSupplierDialog(true)}
          >
            サプライヤー追加
          </Button>

          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
          >
            エクスポート
          </Button>
        </Box>

        {/* Suppliers Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell>サプライヤー情報</TableCell>
                <TableCell>業種</TableCell>
                <TableCell>連絡先</TableCell>
                <TableCell align="right">評価</TableCell>
                <TableCell align="right">取引実績</TableCell>
                <TableCell align="right">パフォーマンス</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSuppliers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((supplier) => (
                <TableRow key={supplier.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                        {supplier.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">{supplier.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{supplier.companyName}</Typography>
                        <Typography variant="caption" color="text.secondary">{supplier.contactPerson}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={getBusinessTypeLabel(supplier.businessType)} size="small" variant="outlined" />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {supplier.categories.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        {supplier.email}
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon fontSize="small" color="action" />
                        {supplier.phone}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Rating value={supplier.rating} precision={0.1} size="small" readOnly />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        ({supplier.rating.toFixed(1)})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {supplier.totalOrders}回
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ¥{supplier.totalValue.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {supplier.performance.overallScore}点
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', mt: 0.5 }}>
                      <Chip label={`納期${supplier.onTimeDeliveryRate}%`} size="small" color="success" />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(supplier.status)} 
                      color={getStatusColor(supplier.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        setSelectedSupplier(supplier);
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
          count={filteredSuppliers.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </CardContent>
    </Card>
  );

  const renderPurchaseOrders = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">発注管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOrderDialog(true)}
          >
            新規発注
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell>発注番号</TableCell>
                <TableCell>サプライヤー</TableCell>
                <TableCell>発注日</TableCell>
                <TableCell>納期</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrders.map((order) => {
                const supplier = suppliers.find(s => s.id === order.supplierId);
                return (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">{order.orderNumber}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{supplier?.name || 'Unknown'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.orderDate.toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.expectedDelivery.toLocaleDateString()}</Typography>
                      {order.actualDelivery && (
                        <Typography variant="caption" color="success.main" display="block">
                          実際: {order.actualDelivery.toLocaleDateString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {order.currency} {order.totalAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        color={order.status === 'delivered' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small">
                        <ReceiptIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderPerformance = () => {
    const performanceTrend = [
      { month: '1月', quality: 88, delivery: 92, communication: 85, price: 90 },
      { month: '2月', quality: 90, delivery: 89, communication: 87, price: 88 },
      { month: '3月', quality: 92, delivery: 94, communication: 90, price: 92 },
      { month: '4月', quality: 89, delivery: 91, communication: 88, price: 94 },
      { month: '5月', quality: 93, delivery: 95, communication: 92, price: 91 }
    ];

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>サプライヤーパフォーマンス推移</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="quality" stroke="#8884d8" strokeWidth={2} name="品質スコア" />
                  <Line type="monotone" dataKey="delivery" stroke="#82ca9d" strokeWidth={2} name="納期スコア" />
                  <Line type="monotone" dataKey="communication" stroke="#ffc658" strokeWidth={2} name="コミュニケーション" />
                  <Line type="monotone" dataKey="price" stroke="#ff7300" strokeWidth={2} name="価格競争力" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Performing Suppliers */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>トップパフォーマー</Typography>
              <Grid container spacing={2}>
                {suppliers
                  .filter(s => s.status === 'active')
                  .sort((a, b) => b.performance.overallScore - a.performance.overallScore)
                  .slice(0, 3)
                  .map((supplier, index) => (
                  <Grid item xs={12} md={4} key={supplier.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Badge badgeContent={index + 1} color="primary">
                            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                              {supplier.name.charAt(0)}
                            </Avatar>
                          </Badge>
                          <Box>
                            <Typography variant="h6">{supplier.name}</Typography>
                            <Rating value={supplier.rating} size="small" readOnly />
                          </Box>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          総合スコア: {supplier.performance.overallScore}点
                        </Typography>
                        
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">品質</Typography>
                            <Typography variant="body2">{supplier.performance.qualityScore}%</Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={supplier.performance.qualityScore} 
                            sx={{ mb: 1 }}
                          />
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">納期</Typography>
                            <Typography variant="body2">{supplier.performance.deliveryScore}%</Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={supplier.performance.deliveryScore}
                            color="success"
                            sx={{ mb: 1 }}
                          />
                        </Box>
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
        サプライヤー管理
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="概要" icon={<AssessmentIcon />} />
          <Tab label="サプライヤー一覧" icon={<BusinessIcon />} />
          <Tab label="発注管理" icon={<ReceiptIcon />} />
          <Tab label="パフォーマンス" icon={<TimelineIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderOverview()}
      {activeTab === 1 && renderSuppliersList()}
      {activeTab === 2 && renderPurchaseOrders()}
      {activeTab === 3 && renderPerformance()}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setSupplierDialog(true);
          setAnchorEl(null);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ContactIcon sx={{ mr: 1 }} />
          連絡
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ReceiptIcon sx={{ mr: 1 }} />
          発注履歴
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <AssessmentIcon sx={{ mr: 1 }} />
          パフォーマンス詳細
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default SupplierManagement;