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
  alpha
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  QrCode as QrCodeIcon,
  Category as CategoryIcon,
  Store as StoreIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  LocalShipping as ShippingIcon,
  AttachMoney as MoneyIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  platform: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  reorderLevel: number;
  maxStock: number;
  unitCost: number;
  sellingPrice: number;
  supplier: string;
  location: string;
  lastUpdated: Date;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  movements: InventoryMovement[];
}

interface InventoryMovement {
  id: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reason: string;
  reference?: string;
  timestamp: Date;
  user: string;
}

interface InventoryAlert {
  id: string;
  itemId: string;
  itemName: string;
  type: 'low_stock' | 'out_of_stock' | 'overstock' | 'reorder_required';
  message: string;
  severity: 'error' | 'warning' | 'info';
  timestamp: Date;
  acknowledged: boolean;
}

const InventoryManagement: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  // Mock data generation
  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    const mockItems: InventoryItem[] = [
      {
        id: '1',
        sku: 'SKU-001',
        name: 'プレミアム Tシャツ',
        category: 'アパレル',
        platform: 'Shopify',
        currentStock: 145,
        reservedStock: 12,
        availableStock: 133,
        reorderLevel: 50,
        maxStock: 500,
        unitCost: 1200,
        sellingPrice: 3500,
        supplier: 'テキスタイル株式会社',
        location: '倉庫A-1-B',
        lastUpdated: new Date(),
        status: 'in_stock',
        movements: []
      },
      {
        id: '2',
        sku: 'SKU-002',
        name: 'スニーカー クラシック',
        category: 'シューズ',
        platform: 'Rakuten',
        currentStock: 23,
        reservedStock: 8,
        availableStock: 15,
        reorderLevel: 30,
        maxStock: 200,
        unitCost: 4500,
        sellingPrice: 12000,
        supplier: 'シューズメーカー',
        location: '倉庫B-2-A',
        lastUpdated: new Date(),
        status: 'low_stock',
        movements: []
      },
      {
        id: '3',
        sku: 'SKU-003',
        name: 'ワイヤレスイヤホン',
        category: 'エレクトロニクス',
        platform: 'Amazon',
        currentStock: 0,
        reservedStock: 0,
        availableStock: 0,
        reorderLevel: 25,
        maxStock: 150,
        unitCost: 2800,
        sellingPrice: 8900,
        supplier: 'エレクトロ商事',
        location: '倉庫C-1-C',
        lastUpdated: new Date(),
        status: 'out_of_stock',
        movements: []
      }
    ];

    const mockAlerts: InventoryAlert[] = [
      {
        id: '1',
        itemId: '2',
        itemName: 'スニーカー クラシック',
        type: 'low_stock',
        message: '在庫が少なくなっています (23個)',
        severity: 'warning',
        timestamp: new Date(),
        acknowledged: false
      },
      {
        id: '2',
        itemId: '3',
        itemName: 'ワイヤレスイヤホン',
        type: 'out_of_stock',
        message: '在庫切れです',
        severity: 'error',
        timestamp: new Date(),
        acknowledged: false
      }
    ];

    setInventoryItems(mockItems);
    setAlerts(mockAlerts);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'success';
      case 'low_stock': return 'warning';
      case 'out_of_stock': return 'error';
      case 'discontinued': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return '在庫あり';
      case 'low_stock': return '在庫少';
      case 'out_of_stock': return '在庫切れ';
      case 'discontinued': return '廃番';
      default: return status;
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || item.platform === filterPlatform;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const renderOverview = () => {
    const totalItems = inventoryItems.length;
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
    const lowStockItems = inventoryItems.filter(item => item.status === 'low_stock').length;
    const outOfStockItems = inventoryItems.filter(item => item.status === 'out_of_stock').length;

    const stockChartData = [
      { name: '在庫あり', value: inventoryItems.filter(item => item.status === 'in_stock').length, color: '#4caf50' },
      { name: '在庫少', value: lowStockItems, color: '#ff9800' },
      { name: '在庫切れ', value: outOfStockItems, color: '#f44336' },
      { name: '廃番', value: inventoryItems.filter(item => item.status === 'discontinued').length, color: '#9e9e9e' }
    ];

    const valueData = inventoryItems.map(item => ({
      name: item.name.substring(0, 10) + '...',
      value: item.currentStock * item.unitCost
    })).slice(0, 5);

    return (
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{totalItems}</Typography>
                  <Typography variant="body2">総商品数</Typography>
                </Box>
                <InventoryIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">¥{totalValue.toLocaleString()}</Typography>
                  <Typography variant="body2">総在庫価値</Typography>
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
                  <Typography variant="h4" fontWeight="bold">{lowStockItems}</Typography>
                  <Typography variant="body2">在庫少商品</Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{outOfStockItems}</Typography>
                  <Typography variant="body2">在庫切れ商品</Typography>
                </Box>
                <TrendingDownIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>在庫状況分布</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stockChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stockChartData.map((entry, index) => (
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

        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>上位商品在庫価値</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={valueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderInventoryList = () => (
    <Card>
      <CardContent>
        {/* Search and Filter Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="商品名またはSKUで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 250 }}
          />
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>プラットフォーム</InputLabel>
            <Select
              value={filterPlatform}
              label="プラットフォーム"
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="Shopify">Shopify</MenuItem>
              <MenuItem value="Rakuten">Rakuten</MenuItem>
              <MenuItem value="Amazon">Amazon</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filterStatus}
              label="ステータス"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="in_stock">在庫あり</MenuItem>
              <MenuItem value="low_stock">在庫少</MenuItem>
              <MenuItem value="out_of_stock">在庫切れ</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setItemDialog(true)}
          >
            商品追加
          </Button>

          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
          >
            エクスポート
          </Button>

          <IconButton onClick={() => setLoading(true)}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {/* Inventory Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell>商品情報</TableCell>
                <TableCell>プラットフォーム</TableCell>
                <TableCell align="right">現在在庫</TableCell>
                <TableCell align="right">利用可能</TableCell>
                <TableCell align="right">再注文レベル</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell align="right">価値</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.sku}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.category}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.platform} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">{item.currentStock}</Typography>
                    {item.reservedStock > 0 && (
                      <Typography variant="caption" color="text.secondary">(-{item.reservedStock} 予約)</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{item.availableStock}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{item.reorderLevel}</Typography>
                    {item.currentStock <= item.reorderLevel && (
                      <WarningIcon color="warning" sx={{ fontSize: 16, ml: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(item.status)} 
                      color={getStatusColor(item.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ¥{(item.currentStock * item.unitCost).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        setSelectedItem(item);
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
          count={filteredItems.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </CardContent>
    </Card>
  );

  const renderAlerts = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsIcon />
          在庫アラート
          <Badge badgeContent={alerts.filter(a => !a.acknowledged).length} color="error" />
        </Typography>

        <List>
          {alerts.map((alert) => (
            <ListItem key={alert.id} divider>
              <Alert 
                severity={alert.severity} 
                sx={{ width: '100%' }}
                action={
                  !alert.acknowledged && (
                    <Button size="small">確認済み</Button>
                  )
                }
              >
                <AlertTitle>{alert.itemName}</AlertTitle>
                {alert.message}
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {alert.timestamp.toLocaleString()}
                </Typography>
              </Alert>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  const renderReports = () => {
    const movementData = [
      { date: '1/1', in: 45, out: 23 },
      { date: '1/2', in: 52, out: 31 },
      { date: '1/3', in: 38, out: 28 },
      { date: '1/4', in: 61, out: 34 },
      { date: '1/5', in: 42, out: 29 },
      { date: '1/6', in: 55, out: 41 },
      { date: '1/7', in: 48, out: 25 }
    ];

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>在庫動向レポート (過去7日間)</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="in" stroke="#4caf50" strokeWidth={2} name="入庫" />
                  <Line type="monotone" dataKey="out" stroke="#f44336" strokeWidth={2} name="出庫" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
            <CardActions>
              <Button startIcon={<ExportIcon />}>レポート出力</Button>
              <Button startIcon={<AssessmentIcon />}>詳細分析</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
        在庫管理
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="概要" icon={<AssessmentIcon />} />
          <Tab label="在庫一覧" icon={<InventoryIcon />} />
          <Tab label="アラート" icon={<Badge badgeContent={alerts.filter(a => !a.acknowledged).length} color="error"><NotificationsIcon /></Badge>} />
          <Tab label="レポート" icon={<TimelineIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderOverview()}
      {activeTab === 1 && renderInventoryList()}
      {activeTab === 2 && renderAlerts()}
      {activeTab === 3 && renderReports()}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setItemDialog(true);
          setAnchorEl(null);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={() => {
          setAdjustmentDialog(true);
          setAnchorEl(null);
        }}>
          <InventoryIcon sx={{ mr: 1 }} />
          在庫調整
        </MenuItem>
        <MenuItem onClick={() => {
          setTransferDialog(true);
          setAnchorEl(null);
        }}>
          <ShippingIcon sx={{ mr: 1 }} />
          移動
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InventoryManagement;