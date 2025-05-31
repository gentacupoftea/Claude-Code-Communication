describe('Dashboard Functionality', () => {
  beforeEach(() => {
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }));
    });
    
    // Mock API responses
    cy.intercept('GET', '**/dashboard/summary', {
      statusCode: 200,
      body: {
        totalOrders: 120,
        totalSales: '$9,876.54',
        averageOrderValue: '$82.30',
        conversionRate: '3.2%',
        topProducts: [
          { id: 'gid://shopify/Product/1', name: 'Test Product 1', sales: 42 },
          { id: 'gid://shopify/Product/2', name: 'Test Product 2', sales: 36 },
          { id: 'gid://shopify/Product/3', name: 'Test Product 3', sales: 28 }
        ],
        recentOrders: [
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
    }).as('dashboardData');
    
    // Mock shop info
    cy.intercept('GET', '**/shop-info', {
      statusCode: 200,
      body: {
        id: '12345',
        name: 'Test Shop',
        domain: 'test-shop.myshopify.com',
        email: 'owner@test-shop.com',
        plan: 'Shopify Plus'
      }
    }).as('shopInfo');
  });

  it('should load dashboard with correct data', () => {
    cy.visit('/dashboard');
    
    // Wait for data loading
    cy.wait('@dashboardData');
    cy.wait('@shopInfo');
    
    // Verify summary cards
    cy.get('[data-testid="summary-card-orders"]').should('contain', '120');
    cy.get('[data-testid="summary-card-sales"]').should('contain', '$9,876.54');
    cy.get('[data-testid="summary-card-aov"]').should('contain', '$82.30');
    cy.get('[data-testid="summary-card-conversion"]').should('contain', '3.2%');
    
    // Verify top products
    cy.get('[data-testid="top-products-table"]').within(() => {
      cy.contains('Test Product 1').should('be.visible');
      cy.contains('Test Product 2').should('be.visible');
      cy.contains('Test Product 3').should('be.visible');
    });
    
    // Verify recent orders
    cy.get('[data-testid="recent-orders-table"]').within(() => {
      cy.contains('#1001').should('be.visible');
      cy.contains('John Doe').should('be.visible');
      cy.contains('$39.98').should('be.visible');
    });
  });

  it('should handle data refresh', () => {
    cy.visit('/dashboard');
    cy.wait('@dashboardData');
    
    // Set up new intercept for refresh
    cy.intercept('GET', '**/dashboard/summary', {
      statusCode: 200,
      body: {
        totalOrders: 125, // Updated value
        totalSales: '$10,123.45', // Updated value
        averageOrderValue: '$81.00',
        conversionRate: '3.3%',
        topProducts: [
          { id: 'gid://shopify/Product/1', name: 'Test Product 1', sales: 45 },
          { id: 'gid://shopify/Product/2', name: 'Test Product 2', sales: 38 },
          { id: 'gid://shopify/Product/3', name: 'Test Product 3', sales: 30 }
        ],
        recentOrders: [
          {
            node: {
              id: 'gid://shopify/Order/1002', // New order
              name: '#1002',
              createdAt: '2023-05-21T11:00:00Z',
              totalPriceSet: {
                shopMoney: {
                  amount: '59.99',
                  currencyCode: 'USD'
                }
              },
              lineItems: {
                edges: [
                  {
                    node: {
                      title: 'Test Product 2',
                      quantity: 2
                    }
                  }
                ]
              },
              customer: {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@example.com'
              }
            }
          }
        ]
      }
    }).as('refreshDashboardData');
    
    // Click refresh button
    cy.get('[data-testid="refresh-dashboard-btn"]').click();
    
    // Wait for refresh request
    cy.wait('@refreshDashboardData');
    
    // Verify updated data
    cy.get('[data-testid="summary-card-orders"]').should('contain', '125');
    cy.get('[data-testid="summary-card-sales"]').should('contain', '$10,123.45');
    
    // New order should be visible
    cy.get('[data-testid="recent-orders-table"]').within(() => {
      cy.contains('#1002').should('be.visible');
      cy.contains('Jane Smith').should('be.visible');
    });
  });

  it('should handle date range filtering', () => {
    cy.visit('/dashboard');
    cy.wait('@dashboardData');
    
    // Set up new intercept for date filtered data
    cy.intercept('GET', '**/dashboard/summary*', (req) => {
      // Check if date range parameters are present
      const hasDateParams = req.url.includes('startDate=') && req.url.includes('endDate=');
      
      if (hasDateParams) {
        req.reply({
          statusCode: 200,
          body: {
            totalOrders: 45, // Filtered value
            totalSales: '$3,789.50', // Filtered value
            averageOrderValue: '$84.21',
            conversionRate: '3.5%',
            topProducts: [
              { id: 'gid://shopify/Product/2', name: 'Test Product 2', sales: 20 },
              { id: 'gid://shopify/Product/1', name: 'Test Product 1', sales: 15 },
              { id: 'gid://shopify/Product/3', name: 'Test Product 3', sales: 10 }
            ],
            recentOrders: [] // Empty for simplicity
          }
        });
      } else {
        req.continue();
      }
    }).as('filteredDashboardData');
    
    // Open date picker
    cy.get('[data-testid="date-range-picker"]').click();
    
    // Select "Last 7 days" option
    cy.contains('Last 7 days').click();
    
    // Wait for filtered data request
    cy.wait('@filteredDashboardData');
    
    // Verify filtered data
    cy.get('[data-testid="summary-card-orders"]').should('contain', '45');
    cy.get('[data-testid="summary-card-sales"]').should('contain', '$3,789.50');
    
    // Check that the date range is displayed
    cy.get('[data-testid="date-range-picker"]').should('contain', 'Last 7 days');
  });

  it('should handle data loading failure', () => {
    // Override the intercept to simulate failure
    cy.intercept('GET', '**/dashboard/summary', {
      statusCode: 500,
      body: {
        error: 'Internal server error'
      }
    }).as('failedDashboardData');
    
    cy.visit('/dashboard');
    
    // Wait for failed request
    cy.wait('@failedDashboardData');
    
    // Check for error message
    cy.contains('Failed to load dashboard data').should('be.visible');
    
    // Check for retry button
    cy.get('[data-testid="retry-dashboard-btn"]').should('be.visible');
    
    // Set up success intercept for retry
    cy.intercept('GET', '**/dashboard/summary', {
      statusCode: 200,
      body: {
        totalOrders: 120,
        totalSales: '$9,876.54',
        averageOrderValue: '$82.30',
        conversionRate: '3.2%',
        topProducts: [],
        recentOrders: []
      }
    }).as('retryDashboardData');
    
    // Click retry
    cy.get('[data-testid="retry-dashboard-btn"]').click();
    
    // Wait for retry request
    cy.wait('@retryDashboardData');
    
    // Data should be loaded
    cy.get('[data-testid="summary-card-orders"]').should('contain', '120');
  });

  it('should allow navigation to product details', () => {
    cy.visit('/dashboard');
    cy.wait('@dashboardData');
    
    // Intercept product details request
    cy.intercept('GET', '**/products/1', {
      statusCode: 200,
      body: {
        id: 'gid://shopify/Product/1',
        title: 'Test Product 1',
        description: 'This is a test product description',
        price: '19.99',
        inventory: 42,
        images: [
          { src: 'https://example.com/image1.jpg' }
        ]
      }
    }).as('productDetails');
    
    // Click on a product in the top products list
    cy.contains('Test Product 1').click();
    
    // Should navigate to product details
    cy.url().should('include', '/products/1');
    
    // Wait for product details request
    cy.wait('@productDetails');
    
    // Verify product details page
    cy.contains('h1', 'Test Product 1').should('be.visible');
    cy.contains('$19.99').should('be.visible');
    cy.contains('This is a test product description').should('be.visible');
  });
});