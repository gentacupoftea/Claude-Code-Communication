/**
 * Shopify Integration Component for Conea
 * Main interface for managing Shopify store connections and operations
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  LinearProgress,
  Menu,
  MenuItem,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Store as StoreIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  Webhook as WebhookIcon,
  Analytics as AnalyticsIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import shopifyService, { ShopifyStore, SyncStatus, WebhookStatus } from '../../services/shopifyService';

// ================================
// Types & Interfaces
// ================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`shopify-tabpanel-${index}`}
      aria-labelledby={`shopify-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ================================
// Main Component
// ================================

const ShopifyIntegration: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connectError, setConnectError] = useState('');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [storeMenuAnchor, setStoreMenuAnchor] = useState<null | HTMLElement>(null);

  const queryClient = useQueryClient();

  // ================================
  // API Queries
  // ================================

  const {
    data: stores,
    isLoading: storesLoading,
    error: storesError,
    refetch: refetchStores
  } = useQuery({
    queryKey: ['shopify-stores'],
    queryFn: shopifyService.getStores
  });

  const {
    data: syncStatuses,
    isLoading: syncLoading
  } = useQuery({
    queryKey: ['shopify-sync-status', stores],
    queryFn: async () => {
      if (!stores || stores.length === 0) return {};
      
      const statuses: Record<string, SyncStatus> = {};
      await Promise.all(
        stores.map(async (store) => {
          try {
            statuses[store.store_id] = await shopifyService.getSyncStatus(store.store_id);
          } catch (error) {
            console.error(`Failed to get sync status for ${store.store_id}:`, error);
          }
        })
      );
      return statuses;
    },
    enabled: !!stores && stores.length > 0,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const {
    data: webhookStatuses,
    isLoading: webhooksLoading
  } = useQuery({
    queryKey: ['shopify-webhook-status', stores],
    queryFn: async () => {
      if (!stores || stores.length === 0) return {};
      
      const statuses: Record<string, WebhookStatus> = {};
      await Promise.all(
        stores.map(async (store) => {
          try {
            statuses[store.store_id] = await shopifyService.getWebhookStatus(store.store_id);
          } catch (error) {
            console.error(`Failed to get webhook status for ${store.store_id}:`, error);
          }
        })
      );
      return statuses;
    },
    enabled: !!stores && stores.length > 0
  });

  // ================================
  // Mutations
  // ================================

  const connectStoreMutation = useMutation({
    mutationFn: (domain: string) => shopifyService.getConnectUrl(domain),
    onSuccess: (data) => {
      // Redirect to Shopify OAuth
      window.location.href = data.oauth_url;
    },
    onError: (error: any) => {
      setConnectError(error.response?.data?.detail || 'Failed to connect store');
    }
  });

  const disconnectStoreMutation = useMutation({
    mutationFn: (storeId: string) => shopifyService.disconnectStore(storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-stores'] });
      setStoreMenuAnchor(null);
    }
  });

  const syncMutation = useMutation({
    mutationFn: ({ storeId, entityType, fullSync }: {
      storeId: string;
      entityType: 'products' | 'orders' | 'customers' | 'inventory';
      fullSync?: boolean;
    }) => shopifyService.startSync(storeId, entityType, fullSync),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-status'] });
    }
  });

  const registerWebhooksMutation = useMutation({
    mutationFn: (storeId: string) => shopifyService.registerWebhooks(storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-webhook-status'] });
    }
  });

  // ================================
  // Event Handlers
  // ================================

  const handleConnectStore = () => {
    if (!shopDomain.trim()) {
      setConnectError('Please enter a shop domain');
      return;
    }

    setConnectError('');
    connectStoreMutation.mutate(shopDomain.trim());
  };

  const handleDisconnectStore = (storeId: string) => {
    if (window.confirm('Are you sure you want to disconnect this store?')) {
      disconnectStoreMutation.mutate(storeId);
    }
  };

  const handleStartSync = (storeId: string, entityType: 'products' | 'orders' | 'customers' | 'inventory') => {
    syncMutation.mutate({ storeId, entityType });
  };

  const handleRegisterWebhooks = (storeId: string) => {
    registerWebhooksMutation.mutate(storeId);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'connected':
        return 'success';
      case 'error':
      case 'failed':
      case 'unhealthy':
        return 'error';
      case 'warning':
      case 'degraded':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'connected':
        return <CheckCircleIcon />;
      case 'error':
      case 'failed':
      case 'unhealthy':
        return <ErrorIcon />;
      case 'warning':
      case 'degraded':
        return <WarningIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };

  // ================================
  // Render Methods
  // ================================

  const renderStoresOverview = () => (
    <Grid container spacing={3}>
      {storesLoading ? (
        <Grid item xs={12}>
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        </Grid>
      ) : stores && stores.length > 0 ? (
        stores.map((store) => {
          const syncStatus = syncStatuses?.[store.store_id];
          const webhookStatus = webhookStatuses?.[store.store_id];
          
          return (
            <Grid item xs={12} md={6} lg={4} key={store.store_id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <StoreIcon color="primary" />
                      <Typography variant="h6" noWrap>
                        {store.store_name || store.shop_domain}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setSelectedStore(store.store_id);
                        setStoreMenuAnchor(e.currentTarget);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {store.shop_domain}
                  </Typography>

                  <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                    <Chip
                      size="small"
                      label={store.sync_enabled ? 'Sync Enabled' : 'Sync Disabled'}
                      color={store.sync_enabled ? 'success' : 'default'}
                    />
                    {webhookStatus && (
                      <Chip
                        size="small"
                        label={`${webhookStatus.registered_webhooks} Webhooks`}
                        color={webhookStatus.registered_webhooks > 0 ? 'primary' : 'default'}
                        icon={<WebhookIcon />}
                      />
                    )}
                  </Box>

                  {syncStatus && (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        <strong>Last Sync:</strong> {syncStatus.last_sync 
                          ? format(new Date(syncStatus.last_sync), 'MMM dd, yyyy HH:mm')
                          : 'Never'
                        }
                      </Typography>
                      
                      <Box display="flex" gap={1} mb={1}>
                        <Chip 
                          size="small" 
                          label={`${syncStatus.products_synced} Products`}
                          variant="outlined"
                        />
                        <Chip 
                          size="small" 
                          label={`${syncStatus.orders_synced} Orders`}
                          variant="outlined"
                        />
                      </Box>

                      <Box display="flex" gap={1} alignItems="center">
                        <Chip
                          size="small"
                          label={syncStatus.api_health}
                          color={getStatusColor(syncStatus.api_health)}
                          icon={getStatusIcon(syncStatus.api_health)}
                        />
                        {syncStatus.sync_in_progress && (
                          <CircularProgress size={16} />
                        )}
                      </Box>
                    </Box>
                  )}

                  <Box display="flex" gap={1} mt={2}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SyncIcon />}
                      onClick={() => handleStartSync(store.store_id, 'products')}
                      disabled={syncStatus?.sync_in_progress}
                    >
                      Sync
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AnalyticsIcon />}
                      onClick={() => setCurrentTab(2)} // Switch to analytics tab
                    >
                      Analytics
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })
      ) : (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box textAlign="center" py={4}>
                <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Shopify stores connected
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Connect your first Shopify store to get started with e-commerce integration
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setConnectDialogOpen(true)}
                >
                  Connect Store
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );

  const renderSyncManagement = () => (
    <Grid container spacing={3}>
      {stores?.map((store) => {
        const syncStatus = syncStatuses?.[store.store_id];
        
        return (
          <Grid item xs={12} key={store.store_id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h6">
                    {store.store_name || store.shop_domain}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['shopify-sync-status'] })}
                  >
                    Refresh
                  </Button>
                </Box>

                {syncStatus?.sync_in_progress && (
                  <Box mb={2}>
                    <Typography variant="body2" gutterBottom>
                      Sync in progress...
                    </Typography>
                    <LinearProgress />
                  </Box>
                )}

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Entity Type</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Last Sync</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Products</TableCell>
                        <TableCell align="right">{syncStatus?.products_synced || 0}</TableCell>
                        <TableCell align="right">
                          {syncStatus?.last_sync 
                            ? format(new Date(syncStatus.last_sync), 'MMM dd, HH:mm')
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => handleStartSync(store.store_id, 'products')}
                            disabled={syncStatus?.sync_in_progress}
                          >
                            Sync Products
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Orders</TableCell>
                        <TableCell align="right">{syncStatus?.orders_synced || 0}</TableCell>
                        <TableCell align="right">
                          {syncStatus?.last_sync 
                            ? format(new Date(syncStatus.last_sync), 'MMM dd, HH:mm')
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => handleStartSync(store.store_id, 'orders')}
                            disabled={syncStatus?.sync_in_progress}
                          >
                            Sync Orders
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Customers</TableCell>
                        <TableCell align="right">{syncStatus?.customers_synced || 0}</TableCell>
                        <TableCell align="right">
                          {syncStatus?.last_sync 
                            ? format(new Date(syncStatus.last_sync), 'MMM dd, HH:mm')
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => handleStartSync(store.store_id, 'customers')}
                            disabled={syncStatus?.sync_in_progress}
                          >
                            Sync Customers
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );

  const renderAnalytics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Store Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Analytics and insights will be displayed here once stores are connected and synchronized.
            </Typography>
            {/* TODO: Implement analytics dashboard */}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Shopify Integration</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setConnectDialogOpen(true)}
          disabled={connectStoreMutation.isPending}
        >
          Connect Store
        </Button>
      </Box>

      {storesError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load stores: {storesError.message}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="Stores" />
          <Tab label="Synchronization" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={currentTab} index={0}>
        {renderStoresOverview()}
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        {renderSyncManagement()}
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {renderAnalytics()}
      </TabPanel>

      {/* Connect Store Dialog */}
      <Dialog open={connectDialogOpen} onClose={() => setConnectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect Shopify Store</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Shop Domain"
            placeholder="your-shop-name.myshopify.com"
            fullWidth
            variant="outlined"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            error={!!connectError}
            helperText={connectError || "Enter your Shopify store domain (e.g., mystore.myshopify.com)"}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConnectStore}
            variant="contained"
            disabled={connectStoreMutation.isPending}
          >
            {connectStoreMutation.isPending ? <CircularProgress size={20} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Store Actions Menu */}
      <Menu
        anchorEl={storeMenuAnchor}
        open={Boolean(storeMenuAnchor)}
        onClose={() => setStoreMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (selectedStore) {
            handleRegisterWebhooks(selectedStore);
          }
        }}>
          <WebhookIcon sx={{ mr: 1 }} />
          Register Webhooks
        </MenuItem>
        <MenuItem onClick={() => setStoreMenuAnchor(null)}>
          <SettingsIcon sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedStore) {
            handleDisconnectStore(selectedStore);
          }
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Disconnect
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ShopifyIntegration;