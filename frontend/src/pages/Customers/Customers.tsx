/**
 * 顧客管理ページ
 * 顧客情報の一覧表示と管理
 */
import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Button,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  Add,
  FilterList,
  Download,
  MoreVert,
  Email,
  Phone,
  LocationOn,
  ShoppingCart,
  TrendingUp,
  AttachMoney,
  CalendarToday,
  Edit,
  Delete,
  Send,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { DataTable, SearchBar, MetricCard } from '../../molecules';
import { Card } from '../../atoms';
import { formatCurrency, formatDate } from '../../utils/format';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date;
  status: 'active' | 'inactive' | 'vip';
  tags: string[];
  createdAt: Date;
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: Date;
}

const CustomersComponent: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const customers: Customer[] = [
    {
      id: '1',
      name: '田中太郎',
      email: 'tanaka@example.com',
      phone: '090-1234-5678',
      location: '東京都渋谷区',
      totalOrders: 24,
      totalSpent: 458000,
      lastOrderDate: new Date('2024-01-18'),
      status: 'vip',
      tags: ['リピーター', 'VIP'],
      createdAt: new Date('2023-01-15'),
    },
    {
      id: '2',
      name: '佐藤花子',
      email: 'sato@example.com',
      location: '大阪府大阪市',
      totalOrders: 5,
      totalSpent: 68000,
      lastOrderDate: new Date('2024-01-10'),
      status: 'active',
      tags: ['新規顧客'],
      createdAt: new Date('2023-12-01'),
    },
    {
      id: '3',
      name: '鈴木一郎',
      email: 'suzuki@example.com',
      phone: '080-9876-5432',
      location: '愛知県名古屋市',
      totalOrders: 12,
      totalSpent: 156000,
      lastOrderDate: new Date('2023-11-20'),
      status: 'inactive',
      tags: ['休眠顧客'],
      createdAt: new Date('2022-06-10'),
    },
  ];

  const columns = [
    {
      id: 'name',
      label: t('customers.name'),
      format: (value: string, row: Customer) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ mr: 2 }}>{value.charAt(0)}</Avatar>
          <Box>
            <Typography variant="body2">{value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'location',
      label: t('customers.location'),
    },
    {
      id: 'totalOrders',
      label: t('customers.orders'),
      numeric: true,
    },
    {
      id: 'totalSpent',
      label: t('customers.totalSpent'),
      numeric: true,
      format: (value: number) => formatCurrency(value),
    },
    {
      id: 'status',
      label: t('customers.status'),
      format: (value: string) => {
        const statusColors: Record<string, any> = {
          active: 'success',
          inactive: 'default',
          vip: 'primary',
        };
        return (
          <Chip
            label={value.toUpperCase()}
            color={statusColors[value]}
            size="small"
          />
        );
      },
    },
    {
      id: 'lastOrderDate',
      label: t('customers.lastOrder'),
      format: (value: Date) => formatDate(value),
    },
  ];

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDialog(true);
  };

  const handleEmailCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEmailDialog(true);
  };

  const renderCustomerDetails = () => {
    if (!selectedCustomer) return null;

    const customerOrders: Order[] = [
      {
        id: '1',
        orderNumber: '#1234',
        total: 32000,
        status: '配送完了',
        createdAt: new Date('2024-01-18'),
      },
      {
        id: '2',
        orderNumber: '#1233',
        total: 15000,
        status: '処理中',
        createdAt: new Date('2024-01-15'),
      },
    ];

    return (
      <Box>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="基本情報" />
          <Tab label="注文履歴" />
          <Tab label="アクティビティ" />
        </Tabs>

        {activeTab === 0 && (
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="メールアドレス"
                        secondary={selectedCustomer.email}
                      />
                      <IconButton>
                        <Email />
                      </IconButton>
                    </ListItem>
                    {selectedCustomer.phone && (
                      <ListItem>
                        <ListItemText
                          primary="電話番号"
                          secondary={selectedCustomer.phone}
                        />
                        <IconButton>
                          <Phone />
                        </IconButton>
                      </ListItem>
                    )}
                    <ListItem>
                      <ListItemText
                        primary="住所"
                        secondary={selectedCustomer.location}
                      />
                      <IconButton>
                        <LocationOn />
                      </IconButton>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="顧客登録日"
                        secondary={formatDate(selectedCustomer.createdAt)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="タグ"
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            {selectedCustomer.tags.map((tag) => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{ mr: 1 }}
                              />
                            ))}
                          </Box>
                        }
                      />
                    </ListItem>
                  </List>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MetricCard
                      title="総購入額"
                      value={selectedCustomer.totalSpent}
                      format="currency"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MetricCard
                      title="注文回数"
                      value={selectedCustomer.totalOrders}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MetricCard
                      title="平均注文額"
                      value={selectedCustomer.totalSpent / selectedCustomer.totalOrders}
                      format="currency"
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 1 && (
          <Box sx={{ mt: 3 }}>
            <DataTable
              columns={[
                { id: 'orderNumber', label: '注文番号' },
                {
                  id: 'total',
                  label: '金額',
                  numeric: true,
                  format: (value: number) => formatCurrency(value),
                },
                { id: 'status', label: 'ステータス' },
                {
                  id: 'createdAt',
                  label: '注文日',
                  format: (value: Date) => formatDate(value),
                },
              ]}
              data={customerOrders}
            />
          </Box>
        )}

        {activeTab === 2 && (
          <Box sx={{ mt: 3 }}>
            <Card>
              <List>
                <ListItem>
                  <ListItemText
                    primary="最終購入"
                    secondary={formatDate(selectedCustomer.lastOrderDate)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="最終メール送信"
                    secondary="2024年1月10日"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="最終ログイン"
                    secondary="2024年1月18日"
                  />
                </ListItem>
              </List>
            </Card>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            {t('customers.title')}
          </Typography>
          <Typography color="text.secondary">
            {customers.length}名の顧客
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
        >
          {t('customers.add')}
        </Button>
      </Box>

      {/* 統計情報 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="総顧客数"
            value={customers.length}
            trend={{ value: 5.2, direction: 'up' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="平均購入額"
            value={227333}
            format="currency"
            trend={{ value: 3.8, direction: 'up' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="リピート率"
            value={68}
            format="percent"
            trend={{ value: 1.2, direction: 'up' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="VIP顧客"
            value={customers.filter(c => c.status === 'vip').length}
            subtitle={`全体の${Math.round(customers.filter(c => c.status === 'vip').length / customers.length * 100)}%`}
          />
        </Grid>
      </Grid>

      {/* 検索とフィルター */}
      <Box sx={{ mb: 3 }}>
        <SearchBar
          placeholder={t('customers.search')}
          showFilters
        />
      </Box>

      {/* 顧客テーブル */}
      <DataTable
        columns={columns}
        data={customers}
        actions={[
          {
            label: '詳細',
            onClick: handleViewCustomer,
          },
          {
            label: 'メール',
            icon: <Email />,
            onClick: handleEmailCustomer,
          },
        ]}
      />

      {/* 顧客詳細ダイアログ */}
      <Dialog
        open={customerDialog}
        onClose={() => setCustomerDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ mr: 2 }}>{selectedCustomer?.name.charAt(0)}</Avatar>
              {selectedCustomer?.name}
            </Box>
            <Box>
              <IconButton onClick={() => setEmailDialog(true)}>
                <Email />
              </IconButton>
              <IconButton>
                <Edit />
              </IconButton>
              <IconButton>
                <Delete />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {renderCustomerDetails()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialog(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* メール送信ダイアログ */}
      <Dialog
        open={emailDialog}
        onClose={() => setEmailDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>メール送信</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
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
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={6}
              label="本文"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" startIcon={<Send />}>
            送信
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export const Customers = mainLayout(CustomersComponent);