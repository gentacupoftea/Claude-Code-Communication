import { LoginPage } from '../support/page-objects'
import { TestDataSets } from '../support/test-data'

describe('Authentication Flow', () => {
  let loginPage: LoginPage

  beforeEach(() => {
    loginPage = new LoginPage()
    
    // Clear cookies and local storage before each test
    cy.clearCookies()
    cy.clearLocalStorage()
    
    // Mock authentication API
    cy.mockApiResponse('auth/login', {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 86400,
      user: TestDataSets.regularUser
    }, 'loginRequest')
    
    // Mock user info endpoint
    cy.mockApiResponse('auth/me', TestDataSets.regularUser, 'userInfoRequest')
  })

  it('should display login form', () => {
    loginPage.visit()
    
    // Verify login form elements
    cy.waitForText('Sign in to your account')
    loginPage.getByTestId('email-input').should('be.visible')
    loginPage.getByTestId('password-input').should('be.visible')
    loginPage.getByTestId('login-button').should('be.visible')
    
    // Verify form validation
    loginPage.clickLogin()
    loginPage.expectErrorMessage('Email is required')
    
    // Enter invalid email
    loginPage.enterEmail('invalid-email')
    loginPage.clickLogin()
    loginPage.expectErrorMessage('Please enter a valid email address')
    
    // Make sure help links are present
    cy.contains('a', 'Forgot password?').should('be.visible')
    cy.contains('a', 'Create account').should('be.visible')
  })

  it('should successfully log in and redirect to dashboard', () => {
    loginPage.visit()
    
    // Enter valid credentials
    loginPage.login(TestDataSets.regularUser.email, TestDataSets.regularUser.password)
    
    // Verify loading state
    loginPage.expectLoadingState()
    
    // Wait for API response
    cy.waitForApiResponse('@loginRequest')
    cy.waitForApiResponse('@userInfoRequest')
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard')
    
    // Verify dashboard elements
    cy.waitForText('Welcome')
    cy.waitForText('Dashboard')
    
    // Verify token was stored in localStorage
    cy.window().then((win) => {
      const tokenStr = win.localStorage.getItem('auth_token')
      expect(tokenStr).to.not.be.null
      
      const token = JSON.parse(tokenStr as string)
      expect(token.accessToken).to.equal('test-access-token')
    })
  })

  it('should handle login failure', () => {
    // Override the login intercept to return an error
    cy.mockApiError('auth/login', 401, {
      error: 'invalid_credentials',
      message: 'Invalid email or password'
    }, 'failedLoginRequest')
    
    loginPage.visit()
    
    // Enter invalid credentials
    loginPage.login('invalid@example.com', 'wrongpassword')
    
    // Wait for API response
    cy.waitForApiResponse('@failedLoginRequest')
    
    // Verify error message
    loginPage.expectLoginError('Invalid email or password')
    
    // Should stay on login page
    cy.url().should('include', '/login')
    
    // Verify no token was stored
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.be.null
    })
  })

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