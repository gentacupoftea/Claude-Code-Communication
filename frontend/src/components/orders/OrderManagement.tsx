import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Avatar,
  Menu,
  Divider,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  FileDownload as ExportIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  LocalShipping as ShippingIcon,
  Payment as PaymentIcon,
  ShoppingCart as OrderIcon,
  TrendingUp,
  TrendingDown,
  Person as PersonIcon,
  CalendarToday,
  Receipt,
} from '@mui/icons-material';

interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    avatar?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  date: Date;
  platform: 'shopify' | 'rakuten' | 'amazon';
  trackingNumber?: string;
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-001',
    customer: { name: '田中太郎', email: 'tanaka@example.com' },
    items: [
      { name: 'MacBook Pro 16"', quantity: 1, price: 298000 },
      { name: 'Magic Mouse', quantity: 1, price: 12800 },
    ],
    total: 310800,
    status: 'delivered',
    paymentStatus: 'paid',
    date: new Date('2024-01-15'),
    platform: 'shopify',
    trackingNumber: 'JP123456789',
  },
  {
    id: '2',
    orderNumber: 'ORD-002',
    customer: { name: '佐藤花子', email: 'sato@example.com' },
    items: [
      { name: 'iPhone 15 Pro', quantity: 1, price: 159800 },
    ],
    total: 159800,
    status: 'processing',
    paymentStatus: 'paid',
    date: new Date('2024-01-20'),
    platform: 'rakuten',
  },
  {
    id: '3',
    orderNumber: 'ORD-003',
    customer: { name: '山田一郎', email: 'yamada@example.com' },
    items: [
      { name: 'AirPods Pro', quantity: 2, price: 39800 },
    ],
    total: 79600,
    status: 'shipped',
    paymentStatus: 'paid',
    date: new Date('2024-01-22'),
    platform: 'amazon',
    trackingNumber: 'JP987654321',
  },
  {
    id: '4',
    orderNumber: 'ORD-004',
    customer: { name: '鈴木次郎', email: 'suzuki@example.com' },
    items: [
      { name: 'iPad Air', quantity: 1, price: 98800 },
    ],
    total: 98800,
    status: 'pending',
    paymentStatus: 'pending',
    date: new Date('2024-01-25'),
    platform: 'shopify',
  },
];

const OrderManagement: React.FC = () => {
  const theme = useTheme();
  const [orders] = useState<Order[]>(mockOrders);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(mockOrders);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // フィルタリング
  React.useEffect(() => {
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (platformFilter !== 'all') {
      filtered = filtered.filter(order => order.platform === platformFilter);
    }

    setFilteredOrders(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, platformFilter, orders]);

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'delivered': return 'success';
      case 'shipped': return 'info';
      case 'processing': return 'warning';
      case 'pending': return 'default';
      case 'cancelled': return 'error';
      case 'paid': return 'success';
      case 'failed': return 'error';
      case 'refunded': return 'secondary';
      default: return 'default';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'shopify': return theme.palette.success.main;
      case 'rakuten': return theme.palette.error.main;
      case 'amazon': return theme.palette.warning.main;
      default: return theme.palette.grey[500];
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, order: Order) => {
    setMenuAnchor(event.currentTarget);
    setSelectedOrder(order);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedOrder(null);
  };

  const handleViewDetails = () => {
    setDetailsOpen(true);
    handleMenuClose();
  };

  const handleExport = () => {
    console.log('Exporting orders...');
  };

  // 統計データ
  const stats = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    deliveredOrders: orders.filter(order => order.status === 'delivered').length,
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          📦 注文管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          全ての注文を一元管理・追跡できます
        </Typography>
      </Box>

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, #34D399, #60A5FA)`,
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
              <OrderIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                総注文数
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {stats.totalOrders}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              全プラットフォーム合計
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
              <PaymentIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                総売上
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              ¥{stats.totalRevenue.toLocaleString()}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              今月の売上合計
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
              <CalendarToday sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                処理待ち
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {stats.pendingOrders}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              要処理の注文数
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
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
              <ShippingIcon sx={{ mr: 1, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                配送完了
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {stats.deliveredOrders}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              配送済み注文数
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* フィルターとアクション */}
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 3,
          p: 3,
          mb: 3,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="注文番号、顧客名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select
                value={statusFilter}
                label="ステータス"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="pending">処理待ち</MenuItem>
                <MenuItem value="processing">処理中</MenuItem>
                <MenuItem value="shipped">発送済み</MenuItem>
                <MenuItem value="delivered">配送完了</MenuItem>
                <MenuItem value="cancelled">キャンセル</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>プラットフォーム</InputLabel>
              <Select
                value={platformFilter}
                label="プラットフォーム"
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="shopify">Shopify</MenuItem>
                <MenuItem value="rakuten">楽天</MenuItem>
                <MenuItem value="amazon">Amazon</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                size="small"
              >
                詳細フィルター
              </Button>
              <Button
                variant="outlined"
                startIcon={<ExportIcon />}
                onClick={handleExport}
                size="small"
              >
                エクスポート
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* 注文テーブル */}
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
            <TableRow>
              <TableCell>注文番号</TableCell>
              <TableCell>顧客</TableCell>
              <TableCell>商品</TableCell>
              <TableCell>金額</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>支払い</TableCell>
              <TableCell>プラットフォーム</TableCell>
              <TableCell>注文日</TableCell>
              <TableCell>アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {order.orderNumber}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, mr: 1, fontSize: '0.875rem' }}>
                        {order.customer.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {order.customer.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.customer.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {order.items.length}品目
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.items[0]?.name}
                      {order.items.length > 1 && ` 他${order.items.length - 1}点`}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      ¥{order.total.toLocaleString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={order.status}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={order.paymentStatus}
                      color={getStatusColor(order.paymentStatus)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={order.platform}
                      size="small"
                      sx={{
                        backgroundColor: alpha(getPlatformColor(order.platform), 0.1),
                        color: getPlatformColor(order.platform),
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {order.date.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, order)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        
        <TablePagination
          component="div"
          count={filteredOrders.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          labelRowsPerPage="表示件数"
        />
      </TableContainer>

      {/* コンテキストメニュー */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <ViewIcon sx={{ mr: 1 }} fontSize="small" />
          詳細表示
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          編集
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ShippingIcon sx={{ mr: 1 }} fontSize="small" />
          配送状況
        </MenuItem>
      </Menu>

      {/* 注文詳細ダイアログ */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          注文詳細 - {selectedOrder?.orderNumber}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    顧客情報
                  </Typography>
                  <Typography variant="body2">
                    <strong>氏名:</strong> {selectedOrder.customer.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>メール:</strong> {selectedOrder.customer.email}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    注文情報
                  </Typography>
                  <Typography variant="body2">
                    <strong>プラットフォーム:</strong> {selectedOrder.platform}
                  </Typography>
                  <Typography variant="body2">
                    <strong>注文日:</strong> {selectedOrder.date.toLocaleDateString()}
                  </Typography>
                  {selectedOrder.trackingNumber && (
                    <Typography variant="body2">
                      <strong>追跡番号:</strong> {selectedOrder.trackingNumber}
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    注文商品
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>商品名</TableCell>
                          <TableCell align="center">数量</TableCell>
                          <TableCell align="right">単価</TableCell>
                          <TableCell align="right">小計</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">¥{item.price.toLocaleString()}</TableCell>
                            <TableCell align="right">
                              ¥{(item.price * item.quantity).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} align="right">
                            <strong>合計:</strong>
                          </TableCell>
                          <TableCell align="right">
                            <strong>¥{selectedOrder.total.toLocaleString()}</strong>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>閉じる</Button>
          <Button variant="contained">編集</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderManagement;