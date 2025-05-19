import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Button,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Tab,
  Tabs,
  useTheme,
  alpha,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  StarIcon,
  ShareIcon,
  TrashIcon,
  DocumentDuplicateIcon as DuplicateIcon,
  PencilIcon,
  ClockIcon,
  ChartBarIcon,
  TableCellsIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { mainLayout } from '../../layouts/MainLayout';

interface Dashboard {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  tags: string[];
  type: 'sales' | 'inventory' | 'customers' | 'analytics';
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
}

const mockDashboards: Dashboard[] = [
  {
    id: '1',
    title: '月間売上レポート',
    description: '各プラットフォーム別の月間売上推移とトップ商品の分析',
    thumbnail: '/images/dashboard-thumbnail-1.png',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    isFavorite: true,
    tags: ['売上', '月次', 'クロスプラットフォーム'],
    type: 'sales',
    updateFrequency: 'daily',
  },
  {
    id: '2',
    title: '在庫管理ダッシュボード',
    description: 'リアルタイムの在庫状況と補充アラート',
    thumbnail: '/images/dashboard-thumbnail-2.png',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-19'),
    isFavorite: false,
    tags: ['在庫', 'アラート', 'リアルタイム'],
    type: 'inventory',
    updateFrequency: 'realtime',
  },
  {
    id: '3',
    title: '顧客分析レポート',
    description: '顧客セグメンテーションとLTV分析',
    thumbnail: '/images/dashboard-thumbnail-3.png',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-18'),
    isFavorite: true,
    tags: ['顧客', 'LTV', 'セグメント'],
    type: 'customers',
    updateFrequency: 'weekly',
  },
];

const SavedDashboardsComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>(mockDashboards);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDashboardType, setNewDashboardType] = useState('sales');

  const handleFilterChange = (event: React.SyntheticEvent, newValue: string) => {
    setFilterTab(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, dashboard: Dashboard) => {
    setAnchorEl(event.currentTarget);
    setSelectedDashboard(dashboard);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDashboard(null);
  };

  const handleToggleFavorite = (dashboardId: string) => {
    setDashboards(prev =>
      prev.map(d =>
        d.id === dashboardId ? { ...d, isFavorite: !d.isFavorite } : d
      )
    );
  };

  const handleCreateDashboard = () => {
    navigate('/dashboard/create');
    setCreateDialogOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sales':
        return <CurrencyDollarIcon style={{ width: 16, height: 16 }} />;
      case 'inventory':
        return <TableCellsIcon style={{ width: 16, height: 16 }} />;
      case 'customers':
        return <UserGroupIcon style={{ width: 16, height: 16 }} />;
      case 'analytics':
        return <ChartBarIcon style={{ width: 16, height: 16 }} />;
      default:
        return <ChartBarIcon style={{ width: 16, height: 16 }} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sales':
        return theme.palette.success.main;
      case 'inventory':
        return theme.palette.info.main;
      case 'customers':
        return theme.palette.warning.main;
      case 'analytics':
        return theme.palette.primary.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const filteredDashboards = dashboards.filter(dashboard => {
    const matchesSearch = dashboard.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dashboard.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dashboard.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = filterTab === 'all' ||
      (filterTab === 'favorites' && dashboard.isFavorite) ||
      dashboard.type === filterTab;

    return matchesSearch && matchesFilter;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h4">
            {t('savedDashboards.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PlusIcon style={{ width: 20, height: 20 }} />}
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('savedDashboards.create')}
          </Button>
        </Box>
        <Typography color="text.secondary">
          {t('savedDashboards.description')}
        </Typography>
      </Box>

      {/* 検索とフィルター */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={t('savedDashboards.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MagnifyingGlassIcon style={{ width: 20, height: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Tabs
              value={filterTab}
              onChange={handleFilterChange}
              aria-label="dashboard filters"
            >
              <Tab label={t('savedDashboards.filter.all')} value="all" />
              <Tab
                label={t('savedDashboards.filter.favorites')}
                value="favorites"
                icon={<StarIcon style={{ width: 16, height: 16 }} />}
                iconPosition="start"
              />
              <Tab label={t('savedDashboards.filter.sales')} value="sales" />
              <Tab label={t('savedDashboards.filter.inventory')} value="inventory" />
              <Tab label={t('savedDashboards.filter.customers')} value="customers" />
            </Tabs>
          </Grid>
        </Grid>
      </Box>

      {/* ダッシュボードグリッド */}
      <Grid container spacing={3}>
        {filteredDashboards.map((dashboard) => (
          <Grid item xs={12} sm={6} md={4} key={dashboard.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
              onClick={() => navigate(`/dashboard/${dashboard.id}`)}
            >
              <CardMedia
                component="img"
                height="160"
                image={dashboard.thumbnail}
                alt={dashboard.title}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="h6" sx={{ flex: 1 }}>
                    {dashboard.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(dashboard.id);
                    }}
                  >
                    {dashboard.isFavorite ? (
                      <StarIconSolid style={{ width: 20, height: 20, color: theme.palette.warning.main }} />
                    ) : (
                      <StarIcon style={{ width: 20, height: 20 }} />
                    )}
                  </IconButton>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {dashboard.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip
                    size="small"
                    icon={getTypeIcon(dashboard.type)}
                    label={dashboard.type}
                    sx={{
                      color: getTypeColor(dashboard.type),
                      borderColor: getTypeColor(dashboard.type),
                    }}
                    variant="outlined"
                  />
                  {dashboard.tags.map((tag) => (
                    <Chip
                      key={tag}
                      size="small"
                      label={tag}
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    <ClockIcon style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle' }} />
                    {t('savedDashboards.updatedAt', { date: dashboard.updatedAt.toLocaleDateString() })}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" color="primary">
                  {t('savedDashboards.view')}
                </Button>
                <IconButton
                  size="small"
                  sx={{ ml: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, dashboard);
                  }}
                >
                  <EllipsisVerticalIcon style={{ width: 20, height: 20 }} />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* コンテキストメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <PencilIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          {t('common.edit')}
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <DuplicateIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          {t('common.duplicate')}
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ShareIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          {t('common.share')}
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: theme.palette.error.main }}>
          <TrashIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          {t('common.delete')}
        </MenuItem>
      </Menu>

      {/* 新規作成ダイアログ */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>{t('savedDashboards.createDialog.title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3 }}>
            {t('savedDashboards.createDialog.description')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t('savedDashboards.createDialog.type')}</InputLabel>
            <Select
              value={newDashboardType}
              label={t('savedDashboards.createDialog.type')}
              onChange={(e) => setNewDashboardType(e.target.value)}
            >
              <MenuItem value="sales">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CurrencyDollarIcon style={{ width: 20, height: 20 }} />
                  {t('savedDashboards.types.sales')}
                </Box>
              </MenuItem>
              <MenuItem value="inventory">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableCellsIcon style={{ width: 20, height: 20 }} />
                  {t('savedDashboards.types.inventory')}
                </Box>
              </MenuItem>
              <MenuItem value="customers">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <UserGroupIcon style={{ width: 20, height: 20 }} />
                  {t('savedDashboards.types.customers')}
                </Box>
              </MenuItem>
              <MenuItem value="analytics">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ChartBarIcon style={{ width: 20, height: 20 }} />
                  {t('savedDashboards.types.analytics')}
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreateDashboard} variant="contained">
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export const SavedDashboards = mainLayout(SavedDashboardsComponent);