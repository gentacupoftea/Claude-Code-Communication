import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Paper, 
  Tabs, 
  Tab,
  Button,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  DataTable, 
  DetailView, 
  FilterBar, 
  DataForm,
  type Column,
  type DetailViewSection,
  type FormField,
  type FormSection,
  type FilterOption
} from '../../components/data';
import { useFetchData, useModifyData, usePaginatedData } from '../../hooks/data';

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
      id={`data-components-tabpanel-${index}`}
      aria-labelledby={`data-components-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Example data interfaces
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

const DataComponentsDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Mock data fetch hook
  const { 
    data: products, 
    isLoading: isLoadingProducts, 
    error: productsError, 
    refetch: refetchProducts 
  } = useFetchData<Product[]>('/api/products', {
    // In a real application, this would make an actual API call
    mockData: [
      { id: '1', name: 'Laptop', category: 'Electronics', price: 1299, stock: 45, status: 'active', createdAt: '2025-01-15T08:30:00Z' },
      { id: '2', name: 'Smartphone', category: 'Electronics', price: 899, stock: 78, status: 'active', createdAt: '2025-01-20T10:15:00Z' },
      { id: '3', name: 'Headphones', category: 'Accessories', price: 199, stock: 120, status: 'active', createdAt: '2025-01-25T14:00:00Z' },
      { id: '4', name: 'Coffee Maker', category: 'Home', price: 89, stock: 34, status: 'inactive', createdAt: '2025-02-01T09:45:00Z' },
      { id: '5', name: 'Desk Chair', category: 'Furniture', price: 249, stock: 12, status: 'active', createdAt: '2025-02-10T11:30:00Z' },
    ],
    fetchOnMount: true,
    cacheKey: 'products',
  });

  // Mock paginated data hook (for table with pagination)
  const {
    data: paginatedProducts,
    isLoading: isLoadingPaginated,
    error: paginatedError,
    pagination,
    sort,
    filters,
    setFilters
  } = usePaginatedData<Product>('/api/products', {
    // In a real application, this would make an actual API call
    mockData: {
      data: [
        { id: '1', name: 'Laptop', category: 'Electronics', price: 1299, stock: 45, status: 'active', createdAt: '2025-01-15T08:30:00Z' },
        { id: '2', name: 'Smartphone', category: 'Electronics', price: 899, stock: 78, status: 'active', createdAt: '2025-01-20T10:15:00Z' },
        { id: '3', name: 'Headphones', category: 'Accessories', price: 199, stock: 120, status: 'active', createdAt: '2025-01-25T14:00:00Z' },
        { id: '4', name: 'Coffee Maker', category: 'Home', price: 89, stock: 34, status: 'inactive', createdAt: '2025-02-01T09:45:00Z' },
        { id: '5', name: 'Desk Chair', category: 'Furniture', price: 249, stock: 12, status: 'active', createdAt: '2025-02-10T11:30:00Z' },
      ],
      total: 5,
      page: 0,
      pageSize: 10
    },
    initialSort: { field: 'createdAt', direction: 'desc' },
    cacheKey: 'paginated-products',
  });

  // Mock modify data hook (for form submission)
  const {
    modify: modifyProduct,
    isLoading: isModifying,
    error: modifyError,
    success
  } = useModifyData('/api/products');

  // Table columns
  const columns: Column<Product>[] = [
    { id: 'name', label: 'Product Name', minWidth: 150, sortable: true },
    { id: 'category', label: 'Category', minWidth: 120, sortable: true },
    { 
      id: 'price', 
      label: 'Price', 
      minWidth: 100, 
      align: 'right', 
      sortable: true,
      format: (value) => `$${value.toFixed(2)}`
    },
    { id: 'stock', label: 'Stock', minWidth: 80, align: 'right', sortable: true },
    { 
      id: 'status', 
      label: 'Status', 
      minWidth: 100, 
      sortable: true,
      format: (value) => (
        <Chip 
          label={value} 
          color={value === 'active' ? 'success' : 'default'} 
          size="small" 
        />
      )
    },
  ];

  // Detail view sections
  const detailSections: DetailViewSection<Product>[] = [
    {
      title: 'Product Information',
      fields: [
        { label: 'Product ID', key: 'id' },
        { label: 'Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { 
          label: 'Price', 
          key: 'price', 
          format: (value) => `$${value.toFixed(2)}` 
        },
        { label: 'Stock', key: 'stock' },
        { 
          label: 'Status', 
          key: 'status',
          format: (value) => (
            <Chip 
              label={value} 
              color={value === 'active' ? 'success' : 'default'} 
              size="small" 
            />
          )
        },
        { 
          label: 'Created At', 
          key: 'createdAt',
          format: (value) => new Date(value).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
      ]
    }
  ];

  // Form sections and fields
  const formSections: FormSection[] = [
    {
      title: 'Product Information',
      fields: [
        { name: 'name', label: 'Product Name', type: 'text', required: true },
        { 
          name: 'category', 
          label: 'Category', 
          type: 'select', 
          options: [
            { label: 'Electronics', value: 'Electronics' },
            { label: 'Accessories', value: 'Accessories' },
            { label: 'Home', value: 'Home' },
            { label: 'Furniture', value: 'Furniture' },
          ],
          required: true
        },
        { name: 'price', label: 'Price', type: 'number', required: true },
        { name: 'stock', label: 'Stock', type: 'number', required: true },
        { 
          name: 'status', 
          label: 'Status', 
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
          required: true
        },
      ]
    }
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    { 
      id: 'category', 
      label: 'Category', 
      type: 'select',
      options: [
        { label: 'All', value: '' },
        { label: 'Electronics', value: 'Electronics' },
        { label: 'Accessories', value: 'Accessories' },
        { label: 'Home', value: 'Home' },
        { label: 'Furniture', value: 'Furniture' },
      ] 
    },
    { 
      id: 'status', 
      label: 'Status', 
      type: 'select',
      options: [
        { label: 'All', value: '' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ] 
    },
    { id: 'price', label: 'Price Range', type: 'range' },
  ];

  // Handle row click
  const handleRowClick = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab(1); // Switch to detail view tab
  };

  // Handle edit button click
  const handleEdit = () => {
    setIsEditMode(true);
    setActiveTab(2); // Switch to form tab
  };

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      await modifyProduct(
        selectedProduct?.id ? 'PUT' : 'POST', 
        selectedProduct?.id ? `/api/products/${selectedProduct.id}` : '/api/products',
        values
      );
      
      setSnackbar({
        open: true,
        message: selectedProduct?.id ? 'Product updated successfully' : 'Product created successfully',
        severity: 'success'
      });
      
      // Reset form and refresh data
      setSelectedProduct(null);
      setIsEditMode(false);
      setActiveTab(0); // Go back to table view
      refetchProducts();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error: ${(error as Error).message}`,
        severity: 'error'
      });
    }
  };

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle filter change
  const handleFilterChange = (filterId: string, value: any) => {
    setFilters({
      ...filters,
      [filterId]: value
    });
  };

  useEffect(() => {
    if (success) {
      refetchProducts();
    }
  }, [success, refetchProducts]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Data Management Components
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Data Table" />
          <Tab label="Detail View" disabled={!selectedProduct} />
          <Tab label="Data Form" />
        </Tabs>

        {/* Data Table Tab */}
        <TabPanel value={activeTab} index={0}>
          <FilterBar 
            filters={filterOptions} 
            values={filters} 
            onChange={handleFilterChange} 
          />
          
          <Box mt={2}>
            <DataTable<Product>
              columns={columns}
              data={paginatedProducts?.data || []}
              keyField="id"
              isLoading={isLoadingPaginated}
              error={paginatedError}
              pagination={{
                count: paginatedProducts?.total || 0,
                page: pagination.page,
                rowsPerPage: pagination.pageSize,
                onPageChange: (_, newPage) => pagination.setPage(newPage),
                onRowsPerPageChange: (e) => pagination.setPageSize(Number(e.target.value))
              }}
              sorting={{
                sortParams: sort,
                onSortChange: (field, direction) => sort.setSort({ field, direction })
              }}
              actions={{
                onEdit: (id) => {
                  const product = paginatedProducts?.data.find(p => p.id === id);
                  if (product) {
                    setSelectedProduct(product);
                    handleEdit();
                  }
                },
                onRefresh: refetchProducts
              }}
              onRowClick={handleRowClick}
              title="Products"
            />
          </Box>
        </TabPanel>

        {/* Detail View Tab */}
        <TabPanel value={activeTab} index={1}>
          {selectedProduct && (
            <>
              <Box display="flex" justifyContent="flex-end" mb={2}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleEdit}
                >
                  Edit Product
                </Button>
              </Box>
              
              <DetailView
                data={selectedProduct}
                sections={detailSections}
              />
            </>
          )}
        </TabPanel>

        {/* Form Tab */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" component="h2" gutterBottom>
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </Typography>
          
          <DataForm
            sections={formSections}
            initialValues={isEditMode ? selectedProduct : {}}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsEditMode(false);
              setSelectedProduct(null);
              setActiveTab(0);
            }}
            isLoading={isModifying}
            error={modifyError}
          />
        </TabPanel>
      </Paper>

      {/* Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default DataComponentsDemo;