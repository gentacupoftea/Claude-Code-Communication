import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Menu,
  Tooltip,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  PersonAdd as AddCustomerIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  ShoppingCart as OrdersIcon,
  AttachMoney as MoneyIcon,
  TrendingUp,
  TrendingDown,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CalendarToday,
  Business,
  Timeline,
  Receipt,
  LocalShipping,
  Loyalty,
  Group,
  PersonPin,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  avatar?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: Date;
  registrationDate: Date;
  status: 'active' | 'inactive' | 'vip' | 'new';
  tags: string[];
  loyaltyPoints: number;
  preferredPlatform: 'shopify' | 'rakuten' | 'amazon';
  notes?: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  platform: string;
  date: Date;
  items: number;
}

const mockCustomers: Customer[] = [
  {
    id: '1',
    name: '田中太郎',
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    location: '東京都渋谷区',
    totalOrders: 28,
    totalSpent: 520000,
    averageOrderValue: 18571,
    lastOrderDate: new Date('2024-01-20'),
    registrationDate: new Date('2022-03-15'),
    status: 'vip',
    tags: ['VIP', 'リピーター', '高額購入'],
    loyaltyPoints: 2600,
    preferredPlatform: 'shopify',
    notes: '重要顧客。カスタムサポート対応',
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'sato.hanako@example.com',
    phone: '080-9876-5432',
    location: '大阪府大阪市',
    totalOrders: 15,
    totalSpent: 245000,
    averageOrderValue: 16333,
    lastOrderDate: new Date('2024-01-18'),
    registrationDate: new Date('2023-08-22'),
    status: 'active',
    tags: ['アクティブ', '定期購入'],
    loyaltyPoints: 1225,
    preferredPlatform: 'rakuten',
  },
  {
    id: '3',
    name: '山田一郎',
    email: 'yamada.ichiro@example.com',
    location: '愛知県名古屋市',
    totalOrders: 3,
    totalSpent: 45000,
    averageOrderValue: 15000,
    lastOrderDate: new Date('2023-12-05'),
    registrationDate: new Date('2023-11-20'),
    status: 'inactive',
    tags: ['新規', '休眠'],
    loyaltyPoints: 225,
    preferredPlatform: 'amazon',
  },
  {
    id: '4',
    name: '鈴木次郎',
    email: 'suzuki.jiro@example.com',
    phone: '070-1111-2222',
    location: '福岡県福岡市',
    totalOrders: 1,
    totalSpent: 12800,
    averageOrderValue: 12800,
    lastOrderDate: new Date('2024-01-25'),
    registrationDate: new Date('2024-01-25'),
    status: 'new',
    tags: ['新規顧客'],
    loyaltyPoints: 64,
    preferredPlatform: 'shopify',
  },
];

const CustomerManagement: React.FC = () => {
  const theme = useTheme();
  const [customers] = useState<Customer[]>(mockCustomers);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>(mockCustomers);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // フィルタリング
  React.useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => customer.status === statusFilter);
    }

    setFilteredCustomers(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, customers]);

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'vip': return 'primary';
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'new': return 'info';
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

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, customer: Customer) => {
    setMenuAnchor(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleViewDetails = () => {
    setDetailsOpen(true);
    handleMenuClose();
  };

  const handleSendEmail = () => {
    setEmailOpen(true);
    handleMenuClose();
  };

  // 顧客統計
  const stats = {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.status === 'active' || c.status === 'vip').length,
    vipCustomers: customers.filter(c => c.status === 'vip').length,
    newCustomers: customers.filter(c => c.status === 'new').length,
    totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    averageOrderValue: customers.reduce((sum, c) => sum + c.averageOrderValue, 0) / customers.length,
  };

  // 顧客の注文履歴（モック）
  const getCustomerOrders = (customerId: string): CustomerOrder[] => {
    return [
      {
        id: '1',
        orderNumber: 'ORD-001',
        total: 32000,
        status: '配送完了',
        platform: 'shopify',
        date: new Date('2024-01-20'),
        items: 3,
      },
      {
        id: '2',
        orderNumber: 'ORD-002',
        total: 18500,
        status: '処理中',
        platform: 'shopify',
        date: new Date('2024-01-15'),
        items: 2,
      },
    ];
  };

  // 顧客活動データ（モック）
  const getCustomerActivityData = () => {
    return [
      { month: 'Oct', orders: 2, spent: 35000 },
      { month: 'Nov', orders: 3, spent: 48000 },
      { month: 'Dec', orders: 4, spent: 62000 },
      { month: 'Jan', orders: 5, spent: 78000 },
    ];
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          👥 顧客管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          顧客情報を一元管理し、関係性を強化
        </Typography>
      </Box>

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
                  <Group />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {stats.totalCustomers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    総顧客数
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: theme.palette.success.main, mr: 2 }}>
                  <Loyalty />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {stats.vipCustomers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    VIP顧客
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: theme.palette.warning.main, mr: 2 }}>
                  <MoneyIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    ¥{Math.round(stats.averageOrderValue).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    平均注文額
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: theme.palette.info.main, mr: 2 }}>
                  <PersonPin />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {stats.newCustomers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    新規顧客
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* フィルターとアクション */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="顧客名、メールアドレスで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select
                value={statusFilter}
                label="ステータス"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="vip">VIP</MenuItem>
                <MenuItem value="active">アクティブ</MenuItem>
                <MenuItem value="inactive">非アクティブ</MenuItem>
                <MenuItem value="new">新規</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                size="small"
              >
                詳細フィルター
              </Button>
              <Button
                variant="contained"
                startIcon={<AddCustomerIcon />}
                size="small"
              >
                顧客追加
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 顧客テーブル */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>顧客</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>注文数</TableCell>
              <TableCell>総購入額</TableCell>
              <TableCell>平均注文額</TableCell>
              <TableCell>最終注文</TableCell>
              <TableCell>ポイント</TableCell>
              <TableCell>アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Badge
                        badgeContent={customer.status === 'vip' ? <StarIcon fontSize="small" /> : null}
                        color="primary"
                      >
                        <Avatar sx={{ width: 40, height: 40, mr: 2 }}>
                          {customer.name.charAt(0)}
                        </Avatar>
                      </Badge>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {customer.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {customer.email}
                        </Typography>
                        <Box display="flex" alignItems="center" mt={0.5}>
                          <LocationIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                          <Typography variant="caption" color="text.secondary">
                            {customer.location}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Box>
                      <Chip
                        label={customer.status.toUpperCase()}
                        color={getStatusColor(customer.status)}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Box display="flex" gap={0.5}>
                        {customer.tags.slice(0, 2).map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {customer.totalOrders}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      ¥{customer.totalSpent.toLocaleString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      ¥{Math.round(customer.averageOrderValue).toLocaleString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {customer.lastOrderDate.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Loyalty color="action" fontSize="small" sx={{ mr: 0.5 }} />
                      <Typography variant="body2">
                        {customer.loyaltyPoints}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, customer)}
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
          count={filteredCustomers.length}
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
          <PersonPin sx={{ mr: 1 }} fontSize="small" />
          詳細表示
        </MenuItem>
        <MenuItem onClick={handleSendEmail}>
          <EmailIcon sx={{ mr: 1 }} fontSize="small" />
          メール送信
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          編集
        </MenuItem>
      </Menu>

      {/* 顧客詳細ダイアログ */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <Avatar sx={{ width: 48, height: 48, mr: 2 }}>
                {selectedCustomer?.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h6">{selectedCustomer?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCustomer?.email}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={1}>
              <Button
                startIcon={<EmailIcon />}
                onClick={handleSendEmail}
                size="small"
              >
                メール
              </Button>
              <Button
                startIcon={<EditIcon />}
                variant="outlined"
                size="small"
              >
                編集
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="基本情報" />
            <Tab label="注文履歴" />
            <Tab label="アクティビティ" />
          </Tabs>
          
          <Box sx={{ mt: 3 }}>
            {activeTab === 0 && selectedCustomer && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        連絡先情報
                      </Typography>
                      <List>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar>
                              <EmailIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary="メールアドレス"
                            secondary={selectedCustomer.email}
                          />
                        </ListItem>
                        {selectedCustomer.phone && (
                          <ListItem>
                            <ListItemAvatar>
                              <Avatar>
                                <PhoneIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary="電話番号"
                              secondary={selectedCustomer.phone}
                            />
                          </ListItem>
                        )}
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar>
                              <LocationIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary="住所"
                            secondary={selectedCustomer.location}
                          />
                        </ListItem>
                      </List>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Typography variant="h6" gutterBottom>
                        タグ
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {selectedCustomer.tags.map(tag => (
                          <Chip key={tag} label={tag} size="small" />
                        ))}
                      </Box>
                      
                      {selectedCustomer.notes && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            メモ
                          </Typography>
                          <Typography variant="body2">
                            {selectedCustomer.notes}
                          </Typography>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary">
                            ¥{selectedCustomer.totalSpent.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            総購入額
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="h6">
                            {selectedCustomer.totalOrders}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            注文数
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="h6">
                            {selectedCustomer.loyaltyPoints}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ポイント
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            )}
            
            {activeTab === 1 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>注文番号</TableCell>
                      <TableCell>金額</TableCell>
                      <TableCell>ステータス</TableCell>
                      <TableCell>プラットフォーム</TableCell>
                      <TableCell>日付</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCustomerOrders(selectedCustomer?.id || '').map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.orderNumber}</TableCell>
                        <TableCell>¥{order.total.toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip label={order.status} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={order.platform}
                            size="small"
                            sx={{ backgroundColor: alpha(getPlatformColor(order.platform), 0.1) }}
                          />
                        </TableCell>
                        <TableCell>{order.date.toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  月別活動状況
                </Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getCustomerActivityData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line 
                        type="monotone" 
                        dataKey="spent" 
                        stroke={theme.palette.primary.main} 
                        strokeWidth={2}
                        name="購入額"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* メール送信ダイアログ */}
      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          📧 メール送信 - {selectedCustomer?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="宛先"
              value={selectedCustomer?.email || ''}
              disabled
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="件名"
              placeholder="件名を入力してください"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={6}
              label="メッセージ"
              placeholder="メッセージを入力してください"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setEmailOpen(false)}
          >
            送信
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerManagement;