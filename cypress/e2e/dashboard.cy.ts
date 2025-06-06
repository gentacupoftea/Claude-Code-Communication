describe('Dashboard Functionality', () => {
  beforeEach(() => {
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('authToken', 'demo-token-123456');
    });
  });

  it('should load dashboard page successfully', () => {
    cy.visit('/dashboard');
    
    // Wait for page to fully load
    cy.waitForPageLoad();
    
    // Wait for redirect if needed (in case of auth check)
    cy.url().should('include', '/dashboard');
    
    // Verify we're on the dashboard page - just check the most basic elements
    cy.contains('ダッシュボード', { timeout: 15000 }).should('be.visible');
    
    // Verify at least one element from the chat interface exists
    cy.contains('Conea AI', { timeout: 15000 }).should('exist');
  });

  it('should allow sending messages in chat', () => {
    cy.visit('/dashboard');
    
    // Wait for page to fully load
    cy.waitForPageLoad();
    
    // Wait for chat interface to be ready
    cy.get('[data-testid="chat-input"]', { timeout: 10000 }).should('be.visible');
    
    // Type a message
    cy.get('[data-testid="chat-input"]').type('こんにちは、今日の天気はどうですか？');
    
    // Send message
    cy.get('[data-testid="send-message-button"]').click();
    
    // Wait a bit for the message to appear
    cy.wait(1000);
    
    // Verify message appears in chat (look for the text in the message area)
    cy.contains('こんにちは、今日の天気はどうですか？').should('be.visible');
    
    // In demo mode, AI response would appear automatically
    // Just verify the input is cleared after sending
    cy.get('[data-testid="chat-input"]').should('have.value', '');
  });

  it('should navigate to settings from sidebar', () => {
    cy.visit('/dashboard');
    
    // Wait for page to load
    cy.contains('プロジェクト').should('be.visible');
    
    // Click settings button in sidebar
    cy.get('button').contains('設定').click();
    
    // Should navigate to settings page
    cy.url().should('include', '/settings');
    
    // Verify settings page loaded
    cy.contains('設定').should('be.visible');
  });

  it('should handle logout', () => {
    cy.visit('/dashboard');
    
    // Wait for page to load
    cy.contains('プロジェクト').should('be.visible');
    
    // Click logout button
    cy.get('[data-testid="logout-button"]').click();
    
    // Should redirect to login page
    cy.url().should('include', '/login');
    
    // Verify token was removed
    cy.window().then((win) => {
      expect(win.localStorage.getItem('authToken')).to.be.null;
    });
  });
});