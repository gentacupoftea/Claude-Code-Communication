describe('Cache Management', () => {
  beforeEach(() => {
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }));
    });
    
    // Mock initial API responses
    cy.intercept('GET', '**/products?*', {
      statusCode: 200,
      body: {
        products: [
          { id: '1', title: 'Product 1', price: '19.99', inventory: 10 },
          { id: '2', title: 'Product 2', price: '29.99', inventory: 20 },
          { id: '3', title: 'Product 3', price: '39.99', inventory: 30 }
        ]
      }
    }).as('productsRequest');
    
    // Mock shop info
    cy.intercept('GET', '**/shop-info', {
      statusCode: 200,
      body: {
        id: '12345',
        name: 'Test Shop',
        domain: 'test-shop.myshopify.com'
      }
    }).as('shopInfo');
  });

  it('should cache API responses and use cached data when available', () => {
    // Visit products page
    cy.visit('/products');
    
    // Wait for initial API request
    cy.wait('@productsRequest');
    
    // Verify products are displayed
    cy.get('[data-testid="product-list"]').should('exist');
    cy.contains('Product 1').should('be.visible');
    cy.contains('Product 2').should('be.visible');
    cy.contains('Product 3').should('be.visible');
    
    // Set up a counter to track API calls
    let apiCallCount = 0;
    
    // Intercept subsequent product requests and count them
    cy.intercept('GET', '**/products?*', (req) => {
      apiCallCount++;
      req.reply({
        statusCode: 200,
        body: {
          products: [
            { id: '1', title: 'Product 1', price: '19.99', inventory: 10 },
            { id: '2', title: 'Product 2', price: '29.99', inventory: 20 },
            { id: '3', title: 'Product 3', price: '39.99', inventory: 30 }
          ]
        }
      });
    }).as('subsequentProductsRequests');
    
    // Navigate away
    cy.visit('/dashboard');
    
    // Navigate back to products - should use cached data without API call
    cy.visit('/products');
    
    // No API request should be made (TTL not expired)
    cy.get('@subsequentProductsRequests.all').should('have.length', 0);
    
    // Products should still be visible from cache
    cy.contains('Product 1').should('be.visible');
    cy.contains('Product 2').should('be.visible');
    cy.contains('Product 3').should('be.visible');
  });

  it('should refresh cache when forced by user', () => {
    // Visit products page
    cy.visit('/products');
    
    // Wait for initial API request
    cy.wait('@productsRequest');
    
    // Set up intercept for forced refresh
    cy.intercept('GET', '**/products?*', {
      statusCode: 200,
      body: {
        products: [
          { id: '1', title: 'Product 1 (Updated)', price: '19.99', inventory: 5 }, // Title changed
          { id: '2', title: 'Product 2', price: '29.99', inventory: 20 },
          { id: '3', title: 'Product 3', price: '39.99', inventory: 30 },
          { id: '4', title: 'Product 4 (New)', price: '49.99', inventory: 15 } // New product
        ]
      }
    }).as('refreshProductsRequest');
    
    // Click refresh button
    cy.get('[data-testid="refresh-button"]').click();
    
    // Wait for refresh request
    cy.wait('@refreshProductsRequest');
    
    // Verify updated data is displayed
    cy.contains('Product 1 (Updated)').should('be.visible');
    cy.contains('Product 4 (New)').should('be.visible');
  });

  it('should expire cache after TTL and make new API request', () => {
    // Visit products page
    cy.visit('/products');
    
    // Wait for initial API request
    cy.wait('@productsRequest');
    
    // Mock the cache TTL by manipulating the cache timestamp
    cy.window().then((win) => {
      // Get the current cache from localStorage
      const cacheKey = 'api_cache_/products';
      const currentCache = JSON.parse(win.localStorage.getItem(cacheKey) || '{}');
      
      // Set timestamp to 1 hour ago (assuming TTL is less than 1 hour)
      currentCache.timestamp = Date.now() - 3600000;
      
      // Save modified cache
      win.localStorage.setItem(cacheKey, JSON.stringify(currentCache));
    });
    
    // Set up intercept for the expired cache request
    cy.intercept('GET', '**/products?*', {
      statusCode: 200,
      body: {
        products: [
          { id: '1', title: 'Product 1', price: '19.99', inventory: 8 }, // Inventory changed
          { id: '2', title: 'Product 2', price: '29.99', inventory: 15 }, // Inventory changed
          { id: '3', title: 'Product 3', price: '39.99', inventory: 30 }
        ]
      }
    }).as('expiredCacheRequest');
    
    // Navigate away
    cy.visit('/dashboard');
    
    // Navigate back to products - should make new API call due to expired TTL
    cy.visit('/products');
    
    // Should make a new API request
    cy.wait('@expiredCacheRequest');
    
    // Verify new data
    cy.get('[data-testid="product-item-1"]').within(() => {
      cy.contains('Inventory: 8').should('be.visible');
    });
    
    cy.get('[data-testid="product-item-2"]').within(() => {
      cy.contains('Inventory: 15').should('be.visible');
    });
  });

  it('should clear cache when user logs out', () => {
    // Visit products page to populate cache
    cy.visit('/products');
    cy.wait('@productsRequest');
    
    // Verify cache is present
    cy.window().then((win) => {
      const cacheKey = 'api_cache_/products';
      const cache = win.localStorage.getItem(cacheKey);
      expect(cache).to.not.be.null;
    });
    
    // Intercept logout request
    cy.intercept('POST', '**/auth/logout', {
      statusCode: 200,
      body: { success: true }
    }).as('logoutRequest');
    
    // Navigate to settings and log out
    cy.visit('/settings');
    cy.get('[data-testid="logout-button"]').click();
    
    // Wait for logout
    cy.wait('@logoutRequest');
    
    // Verify cache is cleared
    cy.window().then((win) => {
      // Check all cache keys are removed
      const cacheKeys = Object.keys(win.localStorage).filter(key => key.startsWith('api_cache_'));
      expect(cacheKeys.length).to.equal(0);
      
      // Auth token should also be removed
      expect(win.localStorage.getItem('auth_token')).to.be.null;
    });
    
    // Should be redirected to login
    cy.url().should('include', '/login');
  });

  it('should handle API errors with stale cache data', () => {
    // Visit products page to populate cache
    cy.visit('/products');
    cy.wait('@productsRequest');
    
    // Force refresh with error
    cy.intercept('GET', '**/products?*', {
      statusCode: 500,
      body: {
        error: 'Internal server error'
      }
    }).as('errorProductsRequest');
    
    // Click refresh button
    cy.get('[data-testid="refresh-button"]').click();
    
    // Wait for error request
    cy.wait('@errorProductsRequest');
    
    // Should show error message
    cy.contains('Failed to refresh products data').should('be.visible');
    
    // But should still display cached data
    cy.contains('Product 1').should('be.visible');
    cy.contains('Product 2').should('be.visible');
    cy.contains('Product 3').should('be.visible');
    
    // Error banner should have a retry button
    cy.get('[data-testid="retry-button"]').should('be.visible');
    
    // Setup success response for retry
    cy.intercept('GET', '**/products?*', {
      statusCode: 200,
      body: {
        products: [
          { id: '1', title: 'Product 1', price: '19.99', inventory: 10 },
          { id: '2', title: 'Product 2', price: '29.99', inventory: 20 },
          { id: '3', title: 'Product 3', price: '39.99', inventory: 30 }
        ]
      }
    }).as('retryProductsRequest');
    
    // Click retry
    cy.get('[data-testid="retry-button"]').click();
    
    // Wait for retry request
    cy.wait('@retryProductsRequest');
    
    // Error message should disappear
    cy.contains('Failed to refresh products data').should('not.exist');
  });
});