export const mockShopData = {
  shop: {
    id: 'gid://shopify/Shop/12345',
    name: 'Test Shop',
    myshopifyDomain: 'test-shop.myshopify.com',
    primaryDomain: {
      url: 'https://test-shop.myshopify.com'
    },
    plan: {
      displayName: 'Shopify Plus',
      partnerDevelopment: false,
      shopifyPlus: true
    }
  }
};

export const mockProductsData = {
  products: {
    edges: [
      {
        node: {
          id: 'gid://shopify/Product/1',
          title: 'Test Product 1',
          handle: 'test-product-1',
          status: 'ACTIVE',
          totalInventory: 10,
          priceRangeV2: {
            minVariantPrice: {
              amount: '19.99',
              currencyCode: 'USD'
            }
          }
        }
      },
      {
        node: {
          id: 'gid://shopify/Product/2',
          title: 'Test Product 2',
          handle: 'test-product-2',
          status: 'ACTIVE',
          totalInventory: 5,
          priceRangeV2: {
            minVariantPrice: {
              amount: '29.99',
              currencyCode: 'USD'
            }
          }
        }
      }
    ]
  }
};

export const mockOrdersData = {
  orders: {
    edges: [
      {
        node: {
          id: 'gid://shopify/Order/1001',
          name: '#1001',
          createdAt: '2023-05-21T10:00:00Z',
          totalPriceSet: {
            shopMoney: {
              amount: '39.98',
              currencyCode: 'USD'
            }
          },
          lineItems: {
            edges: [
              {
                node: {
                  title: 'Test Product 1',
                  quantity: 2
                }
              }
            ]
          },
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        }
      }
    ]
  }
};

export const mockDashboardData = {
  totalOrders: 120,
  totalSales: '$9,876.54',
  averageOrderValue: '$82.30',
  conversionRate: '3.2%',
  topProducts: [
    { id: 'gid://shopify/Product/1', name: 'Test Product 1', sales: 42 },
    { id: 'gid://shopify/Product/2', name: 'Test Product 2', sales: 36 },
    { id: 'gid://shopify/Product/3', name: 'Test Product 3', sales: 28 }
  ],
  recentOrders: mockOrdersData.orders.edges
};

export const mockAuthResponse = {
  accessToken: 'test-access-token',
  expiresIn: 86400,
  refreshToken: 'test-refresh-token',
  scope: 'read_products,write_products,read_orders',
  shopId: '12345'
};

export const mockErrorResponse = {
  error: 'unauthorized',
  error_description: 'Invalid credentials provided'
};