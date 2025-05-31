describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear cookies and local storage before each test
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Intercept API requests
    cy.intercept('POST', '**/auth/token', (req) => {
      // Mock successful token response
      req.reply({
        statusCode: 200,
        body: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 86400,
          scope: 'read_products,write_products,read_orders',
          shopId: '12345'
        }
      });
    }).as('loginRequest');
    
    // Intercept shop info request after login
    cy.intercept('GET', '**/shop-info', {
      statusCode: 200,
      body: {
        id: '12345',
        name: 'Test Shop',
        domain: 'test-shop.myshopify.com',
        email: 'owner@test-shop.com',
        plan: 'Shopify Plus'
      }
    }).as('shopInfoRequest');
  });

  it('should display login form', () => {
    cy.visit('/login');
    
    // Verify login form elements
    cy.contains('h1', 'Sign in to your Shopify store').should('be.visible');
    cy.get('input[name="shopDomain"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible').and('contain', 'Sign in');
    
    // Verify form validation
    cy.get('button[type="submit"]').click();
    cy.contains('Shop domain is required').should('be.visible');
    
    // Enter invalid domain
    cy.get('input[name="shopDomain"]').type('invalid-domain');
    cy.get('button[type="submit"]').click();
    cy.contains('Please enter a valid Shopify shop domain').should('be.visible');
    
    // Make sure help links are present
    cy.contains('a', 'Get help').should('be.visible');
    cy.contains('a', 'Privacy policy').should('be.visible');
  });

  it('should successfully log in and redirect to dashboard', () => {
    cy.visit('/login');
    
    // Enter valid shop domain
    cy.get('input[name="shopDomain"]').type('test-shop.myshopify.com');
    cy.get('button[type="submit"]').click();
    
    // Verify loading state
    cy.contains('Connecting to Shopify...').should('be.visible');
    
    // Wait for API response
    cy.wait('@loginRequest');
    cy.wait('@shopInfoRequest');
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    
    // Verify dashboard elements
    cy.contains('Test Shop').should('be.visible');
    cy.contains('Dashboard').should('be.visible');
    
    // Verify token was stored in localStorage
    cy.window().then((win) => {
      const tokenStr = win.localStorage.getItem('auth_token');
      expect(tokenStr).to.not.be.null;
      
      const token = JSON.parse(tokenStr as string);
      expect(token.accessToken).to.equal('test-access-token');
    });
  });

  it('should handle login failure', () => {
    // Override the login intercept to return an error
    cy.intercept('POST', '**/auth/token', {
      statusCode: 401,
      body: {
        error: 'invalid_request',
        error_description: 'Invalid shop domain'
      }
    }).as('failedLoginRequest');
    
    cy.visit('/login');
    
    // Enter shop domain
    cy.get('input[name="shopDomain"]').type('invalid-shop.myshopify.com');
    cy.get('button[type="submit"]').click();
    
    // Wait for API response
    cy.wait('@failedLoginRequest');
    
    // Verify error message
    cy.contains('Authentication failed').should('be.visible');
    
    // Should stay on login page
    cy.url().should('include', '/login');
    
    // Verify no token was stored
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.be.null;
    });
  });

  it('should redirect to login when accessing protected routes without authentication', () => {
    // Try to access dashboard directly
    cy.visit('/dashboard');
    
    // Should redirect to login
    cy.url().should('include', '/login');
    
    // Try to access settings
    cy.visit('/settings');
    
    // Should redirect to login
    cy.url().should('include', '/login');
  });

  it('should log out correctly', () => {
    // Set up mock authentication data
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }));
    });
    
    // Intercept logout request
    cy.intercept('POST', '**/auth/logout', {
      statusCode: 200,
      body: { success: true }
    }).as('logoutRequest');
    
    // Visit dashboard (should be authenticated now)
    cy.visit('/dashboard');
    
    // Click logout
    cy.get('[data-testid="user-menu"]').click();
    cy.contains('Sign out').click();
    
    // Wait for logout request
    cy.wait('@logoutRequest');
    
    // Should redirect to login
    cy.url().should('include', '/login');
    
    // Verify token was removed
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.be.null;
    });
  });
});