const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mock data
const mockProducts = [
  {
    id: 1,
    title: "Test Product 1",
    vendor: "Test Vendor",
    product_type: "Test Type",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    published_at: "2024-01-01T00:00:00Z",
    status: "active",
    variants: [
      {
        id: 1,
        product_id: 1,
        title: "Default Title",
        price: "10.00",
        sku: "TEST-001",
        inventory_quantity: 100
      }
    ]
  },
  {
    id: 2,
    title: "Test Product 2",
    vendor: "Test Vendor",
    product_type: "Test Type",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    published_at: "2024-01-02T00:00:00Z",
    status: "active",
    variants: [
      {
        id: 2,
        product_id: 2,
        title: "Default Title",
        price: "20.00",
        sku: "TEST-002",
        inventory_quantity: 50
      }
    ]
  }
];

const mockOrders = [
  {
    id: 1,
    order_number: 1001,
    email: "test@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    total_price: "30.00",
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    line_items: [
      {
        id: 1,
        variant_id: 1,
        quantity: 1,
        price: "10.00"
      },
      {
        id: 2,
        variant_id: 2,
        quantity: 1,
        price: "20.00"
      }
    ]
  }
];

const mockCustomers = [
  {
    id: 1,
    email: "test@example.com",
    first_name: "Test",
    last_name: "Customer",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    total_spent: "30.00",
    orders_count: 1,
    state: "enabled"
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mock-shopify' });
});

// GraphQL endpoint (basic mock)
app.post('/graphql', (req, res) => {
  const { query } = req.body;
  
  // Mock GraphQL response based on query
  if (query.includes('products')) {
    res.json({
      data: {
        products: {
          edges: mockProducts.map(product => ({
            node: product
          }))
        }
      }
    });
  } else if (query.includes('orders')) {
    res.json({
      data: {
        orders: {
          edges: mockOrders.map(order => ({
            node: order
          }))
        }
      }
    });
  } else {
    res.json({
      data: {},
      errors: []
    });
  }
});

// REST API endpoints
app.get('/admin/api/2024-01/products.json', (req, res) => {
  res.json({ products: mockProducts });
});

app.get('/admin/api/2024-01/products/:id.json', (req, res) => {
  const product = mockProducts.find(p => p.id === parseInt(req.params.id));
  if (product) {
    res.json({ product });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.get('/admin/api/2024-01/orders.json', (req, res) => {
  res.json({ orders: mockOrders });
});

app.get('/admin/api/2024-01/orders/:id.json', (req, res) => {
  const order = mockOrders.find(o => o.id === parseInt(req.params.id));
  if (order) {
    res.json({ order });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

app.get('/admin/api/2024-01/customers.json', (req, res) => {
  res.json({ customers: mockCustomers });
});

app.get('/admin/api/2024-01/customers/:id.json', (req, res) => {
  const customer = mockCustomers.find(c => c.id === parseInt(req.params.id));
  if (customer) {
    res.json({ customer });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock Shopify API server running on port ${PORT}`);
});