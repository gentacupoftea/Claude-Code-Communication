/// <reference types="cypress" />

// Custom Cypress commands for Conea AI Platform E2E tests

// Add tab command support
declare global {
  namespace Cypress {
    interface Chainable {
      tab(options?: { shift?: boolean }): Chainable<JQuery<HTMLElement>>
      // Authentication commands
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      loginApi(credentials?: { email: string; password: string }): Chainable<void>
      
      // Wait commands
      waitForPageLoad(): Chainable<void>
      waitForApiResponse(alias: string, timeout?: number): Chainable<void>
      waitForText(text: string, timeout?: number): Chainable<void>
      waitForElement(selector: string, timeout?: number): Chainable<void>
      
      // UI interaction commands
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>
      clickByTestId(testId: string): Chainable<void>
      typeByTestId(testId: string, text: string): Chainable<void>
      
      // Form commands
      fillForm(formData: Record<string, string>): Chainable<void>
      submitForm(formSelector?: string): Chainable<void>
      
      // API commands
      mockApiResponse(endpoint: string, response: any, alias?: string): Chainable<void>
      mockApiError(endpoint: string, statusCode: number, error: any, alias?: string): Chainable<void>
      
      // MultiLLM commands
      switchLLMProvider(provider: 'openai' | 'anthropic' | 'google'): Chainable<void>
      sendChatMessage(message: string): Chainable<void>
      
      // Dashboard commands
      refreshDashboard(): Chainable<void>
      selectDateRange(range: string): Chainable<void>
      
      // Error handling commands
      expectErrorMessage(message: string): Chainable<void>
      expectSuccessMessage(message: string): Chainable<void>
      
      // State management commands
      saveAppState(stateName: string): Chainable<void>
      restoreAppState(stateName: string): Chainable<void>
    }
  }
}

// Authentication commands
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
  cy.visit('/login')
  cy.waitForPageLoad()
  
  cy.getByTestId('email-input').type(email)
  cy.getByTestId('password-input').type(password)
  cy.getByTestId('login-button').click()
  
  // Wait for navigation instead of API response in demo mode
  cy.url().should('include', '/dashboard')
  cy.waitForPageLoad()
})

Cypress.Commands.add('logout', () => {
  cy.getByTestId('user-menu').click()
  cy.getByTestId('logout-button').click()
  cy.url().should('include', '/login')
})

Cypress.Commands.add('loginApi', (credentials = { email: 'test@example.com', password: 'password123' }) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: credentials
  }).then((response) => {
    window.localStorage.setItem('auth_token', JSON.stringify(response.body))
  })
})

// Wait commands
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body').should('be.visible')
  cy.document().should('have.property', 'readyState', 'complete')
})

Cypress.Commands.add('waitForApiResponse', (alias: string, timeout: number = 10000) => {
  cy.wait(alias, { timeout })
})

Cypress.Commands.add('waitForText', (text: string, timeout: number = 10000) => {
  cy.contains(text, { timeout }).should('be.visible')
})

Cypress.Commands.add('waitForElement', (selector: string, timeout: number = 10000) => {
  cy.get(selector, { timeout }).should('be.visible')
})

// UI interaction commands
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`)
})

Cypress.Commands.add('clickByTestId', (testId: string) => {
  cy.getByTestId(testId).click()
})

Cypress.Commands.add('typeByTestId', (testId: string, text: string) => {
  cy.getByTestId(testId).type(text)
})

// Form commands
Cypress.Commands.add('fillForm', (formData: Record<string, string>) => {
  Object.entries(formData).forEach(([field, value]) => {
    cy.getByTestId(`${field}-input`).clear().type(value)
  })
})

Cypress.Commands.add('submitForm', (formSelector = 'form') => {
  cy.get(formSelector).submit()
})

// API commands
Cypress.Commands.add('mockApiResponse', (endpoint: string, response: any, alias?: string) => {
  const aliasName = alias || `${endpoint.replace(/[^a-zA-Z0-9]/g, '')}_success`
  // Support both GET and POST requests
  cy.intercept('*', `**/${endpoint}`, {
    statusCode: 200,
    body: response
  }).as(aliasName)
})

Cypress.Commands.add('mockApiError', (endpoint: string, statusCode: number, error: any, alias?: string) => {
  const aliasName = alias || `${endpoint.replace(/[^a-zA-Z0-9]/g, '')}_error`
  // Support both GET and POST requests
  cy.intercept('*', `**/${endpoint}`, {
    statusCode,
    body: error
  }).as(aliasName)
})

// MultiLLM commands
Cypress.Commands.add('switchLLMProvider', (provider: 'openai' | 'anthropic' | 'google') => {
  cy.getByTestId('llm-provider-selector').click()
  cy.getByTestId(`provider-option-${provider}`).click()
  cy.waitForText(`Switched to ${provider}`)
})

Cypress.Commands.add('sendChatMessage', (message: string) => {
  cy.getByTestId('chat-input').type(message)
  cy.getByTestId('send-message-button').click()
  cy.getByTestId('chat-messages').should('contain', message)
})

// Dashboard commands
Cypress.Commands.add('refreshDashboard', () => {
  cy.getByTestId('refresh-dashboard-btn').click()
  cy.waitForText('Dashboard updated')
})

Cypress.Commands.add('selectDateRange', (range: string) => {
  cy.getByTestId('date-range-picker').click()
  cy.contains(range).click()
})

// Error handling commands
Cypress.Commands.add('expectErrorMessage', (message: string) => {
  cy.getByTestId('error-message').should('be.visible').and('contain', message)
})

Cypress.Commands.add('expectSuccessMessage', (message: string) => {
  cy.getByTestId('success-message').should('be.visible').and('contain', message)
})

// State management commands
Cypress.Commands.add('saveAppState', (stateName: string) => {
  cy.window().then((win) => {
    const state = {
      localStorage: { ...win.localStorage },
      sessionStorage: { ...win.sessionStorage },
      cookies: document.cookie
    }
    cy.writeFile(`cypress/fixtures/states/${stateName}.json`, state)
  })
})

Cypress.Commands.add('restoreAppState', (stateName: string) => {
  cy.readFile(`cypress/fixtures/states/${stateName}.json`).then((state) => {
    Object.entries(state.localStorage).forEach(([key, value]) => {
      window.localStorage.setItem(key, value as string)
    })
    Object.entries(state.sessionStorage).forEach(([key, value]) => {
      window.sessionStorage.setItem(key, value as string)
    })
  })
})

// Tab command implementation
Cypress.Commands.add('tab', { prevSubject: 'optional' }, (subject, options = {}) => {
  const el = subject ? cy.wrap(subject) : cy.focused()
  
  return el.trigger('keydown', {
    keyCode: 9,
    which: 9,
    shiftKey: options.shift || false
  })
})