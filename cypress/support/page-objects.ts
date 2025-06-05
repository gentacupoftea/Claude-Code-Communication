// Page Object Model for Conea AI Platform E2E Tests

export class BasePage {
  protected baseUrl: string = Cypress.config('baseUrl') || 'http://localhost:3000'
  
  visit(path: string = ''): void {
    cy.visit(path)
    cy.waitForPageLoad()
  }
  
  getByTestId(testId: string): Cypress.Chainable {
    return cy.getByTestId(testId)
  }
  
  clickByTestId(testId: string): void {
    cy.clickByTestId(testId)
  }
  
  typeByTestId(testId: string, text: string): void {
    cy.typeByTestId(testId, text)
  }
  
  waitForText(text: string, timeout: number = 10000): void {
    cy.waitForText(text, timeout)
  }
  
  expectErrorMessage(message: string): void {
    cy.expectErrorMessage(message)
  }
  
  expectSuccessMessage(message: string): void {
    cy.expectSuccessMessage(message)
  }
}

export class LoginPage extends BasePage {
  private selectors = {
    emailInput: 'email-input',
    passwordInput: 'password-input',
    loginButton: 'login-button',
    signupLink: 'signup-link',
    forgotPasswordLink: 'forgot-password-link',
    errorMessage: 'error-message',
    loadingSpinner: 'loading-spinner'
  }
  
  visit(): void {
    super.visit('/login')
  }
  
  enterEmail(email: string): void {
    this.typeByTestId(this.selectors.emailInput, email)
  }
  
  enterPassword(password: string): void {
    this.typeByTestId(this.selectors.passwordInput, password)
  }
  
  clickLogin(): void {
    this.clickByTestId(this.selectors.loginButton)
  }
  
  clickSignupLink(): void {
    this.clickByTestId(this.selectors.signupLink)
  }
  
  clickForgotPassword(): void {
    this.clickByTestId(this.selectors.forgotPasswordLink)
  }
  
  login(email: string, password: string): void {
    this.enterEmail(email)
    this.enterPassword(password)
    this.clickLogin()
  }
  
  expectLoginError(message: string): void {
    this.expectErrorMessage(message)
  }
  
  expectLoadingState(): void {
    this.getByTestId(this.selectors.loadingSpinner).should('be.visible')
  }
}

export class DashboardPage extends BasePage {
  private selectors = {
    welcomeMessage: 'welcome-message',
    userMenu: 'user-menu',
    logoutButton: 'logout-button',
    refreshButton: 'refresh-dashboard-btn',
    retryButton: 'retry-dashboard-btn',
    dateRangePicker: 'date-range-picker',
    summaryCards: {
      orders: 'summary-card-orders',
      sales: 'summary-card-sales',
      aov: 'summary-card-aov',
      conversion: 'summary-card-conversion'
    },
    topProductsTable: 'top-products-table',
    recentOrdersTable: 'recent-orders-table',
    analyticsChart: 'analytics-chart',
    sidebar: 'sidebar',
    navigationMenu: 'navigation-menu'
  }
  
  visit(): void {
    super.visit('/dashboard')
  }
  
  refresh(): void {
    this.clickByTestId(this.selectors.refreshButton)
  }
  
  retry(): void {
    this.clickByTestId(this.selectors.retryButton)
  }
  
  selectDateRange(range: string): void {
    this.clickByTestId(this.selectors.dateRangePicker)
    cy.contains(range).click()
  }
  
  logout(): void {
    this.clickByTestId(this.selectors.userMenu)
    this.clickByTestId(this.selectors.logoutButton)
  }
  
  expectSummaryCardValue(card: keyof typeof this.selectors.summaryCards, value: string): void {
    this.getByTestId(this.selectors.summaryCards[card]).should('contain', value)
  }
  
  expectTopProduct(productName: string): void {
    this.getByTestId(this.selectors.topProductsTable).should('contain', productName)
  }
  
  expectRecentOrder(orderNumber: string): void {
    this.getByTestId(this.selectors.recentOrdersTable).should('contain', orderNumber)
  }
  
  navigateToProduct(productName: string): void {
    this.getByTestId(this.selectors.topProductsTable).contains(productName).click()
  }
}

export class MultiLLMChatPage extends BasePage {
  private selectors = {
    providerSelector: 'llm-provider-selector',
    chatInput: 'chat-input',
    sendButton: 'send-message-button',
    chatMessages: 'chat-messages',
    clearChatButton: 'clear-chat-button',
    exportChatButton: 'export-chat-button',
    modelSettings: 'model-settings',
    temperatureSlider: 'temperature-slider',
    maxTokensInput: 'max-tokens-input',
    systemPromptInput: 'system-prompt-input'
  }
  
  visit(): void {
    super.visit('/multillm-chat')
  }
  
  selectProvider(provider: 'openai' | 'anthropic' | 'google'): void {
    this.clickByTestId(this.selectors.providerSelector)
    this.clickByTestId(`provider-option-${provider}`)
  }
  
  sendMessage(message: string): void {
    this.typeByTestId(this.selectors.chatInput, message)
    this.clickByTestId(this.selectors.sendButton)
  }
  
  clearChat(): void {
    this.clickByTestId(this.selectors.clearChatButton)
  }
  
  exportChat(): void {
    this.clickByTestId(this.selectors.exportChatButton)
  }
  
  setTemperature(value: number): void {
    this.getByTestId(this.selectors.temperatureSlider).invoke('val', value).trigger('change')
  }
  
  setMaxTokens(tokens: number): void {
    this.getByTestId(this.selectors.maxTokensInput).clear().type(tokens.toString())
  }
  
  setSystemPrompt(prompt: string): void {
    this.getByTestId(this.selectors.systemPromptInput).clear().type(prompt)
  }
  
  expectMessage(message: string): void {
    this.getByTestId(this.selectors.chatMessages).should('contain', message)
  }
  
  expectProviderSwitched(provider: string): void {
    this.waitForText(`Switched to ${provider}`)
  }
}

export class ProjectsPage extends BasePage {
  private selectors = {
    createProjectButton: 'create-project-button',
    projectList: 'project-list',
    projectItem: 'project-item',
    projectName: 'project-name-input',
    projectDescription: 'project-description-input',
    saveProjectButton: 'save-project-button',
    cancelProjectButton: 'cancel-project-button',
    editProjectButton: 'edit-project-button',
    deleteProjectButton: 'delete-project-button',
    confirmDeleteButton: 'confirm-delete-button',
    searchInput: 'project-search-input',
    filterDropdown: 'project-filter-dropdown',
    sortDropdown: 'project-sort-dropdown'
  }
  
  visit(): void {
    super.visit('/projects')
  }
  
  createProject(name: string, description: string): void {
    this.clickByTestId(this.selectors.createProjectButton)
    this.typeByTestId(this.selectors.projectName, name)
    this.typeByTestId(this.selectors.projectDescription, description)
    this.clickByTestId(this.selectors.saveProjectButton)
  }
  
  editProject(projectId: string, name: string, description: string): void {
    this.getByTestId(`${this.selectors.editProjectButton}-${projectId}`).click()
    this.getByTestId(this.selectors.projectName).clear().type(name)
    this.getByTestId(this.selectors.projectDescription).clear().type(description)
    this.clickByTestId(this.selectors.saveProjectButton)
  }
  
  deleteProject(projectId: string): void {
    this.getByTestId(`${this.selectors.deleteProjectButton}-${projectId}`).click()
    this.clickByTestId(this.selectors.confirmDeleteButton)
  }
  
  searchProjects(query: string): void {
    this.typeByTestId(this.selectors.searchInput, query)
  }
  
  filterProjects(filter: string): void {
    this.clickByTestId(this.selectors.filterDropdown)
    cy.contains(filter).click()
  }
  
  sortProjects(sortBy: string): void {
    this.clickByTestId(this.selectors.sortDropdown)
    cy.contains(sortBy).click()
  }
  
  expectProjectExists(projectName: string): void {
    this.getByTestId(this.selectors.projectList).should('contain', projectName)
  }
  
  expectProjectNotExists(projectName: string): void {
    this.getByTestId(this.selectors.projectList).should('not.contain', projectName)
  }
}

export class APISettingsPage extends BasePage {
  private selectors = {
    apiKeyInput: 'api-key-input',
    saveApiKeyButton: 'save-api-key-button',
    testConnectionButton: 'test-connection-button',
    deleteApiKeyButton: 'delete-api-key-button',
    apiKeyList: 'api-key-list',
    addApiKeyButton: 'add-api-key-button',
    apiProviderDropdown: 'api-provider-dropdown',
    connectionStatus: 'connection-status',
    rateLimitInfo: 'rate-limit-info',
    usageStats: 'usage-stats'
  }
  
  visit(): void {
    super.visit('/settings/api')
  }
  
  addApiKey(provider: string, apiKey: string): void {
    this.clickByTestId(this.selectors.addApiKeyButton)
    this.clickByTestId(this.selectors.apiProviderDropdown)
    cy.contains(provider).click()
    this.typeByTestId(this.selectors.apiKeyInput, apiKey)
    this.clickByTestId(this.selectors.saveApiKeyButton)
  }
  
  testConnection(provider: string): void {
    this.getByTestId(`${this.selectors.testConnectionButton}-${provider}`).click()
  }
  
  deleteApiKey(provider: string): void {
    this.getByTestId(`${this.selectors.deleteApiKeyButton}-${provider}`).click()
  }
  
  expectConnectionStatus(provider: string, status: 'connected' | 'disconnected'): void {
    this.getByTestId(`${this.selectors.connectionStatus}-${provider}`).should('contain', status)
  }
  
  expectApiKeyExists(provider: string): void {
    this.getByTestId(this.selectors.apiKeyList).should('contain', provider)
  }
  
  expectRateLimitInfo(provider: string): void {
    this.getByTestId(`${this.selectors.rateLimitInfo}-${provider}`).should('be.visible')
  }
}

export class RegistrationPage extends BasePage {
  private selectors = {
    emailInput: 'email-input',
    passwordInput: 'password-input',
    confirmPasswordInput: 'confirm-password-input',
    firstNameInput: 'first-name-input',
    lastNameInput: 'last-name-input',
    termsCheckbox: 'terms-checkbox',
    newsletterCheckbox: 'newsletter-checkbox',
    registerButton: 'register-button',
    loginLink: 'login-link',
    passwordStrengthIndicator: 'password-strength-indicator',
    validationErrors: 'validation-errors'
  }
  
  visit(): void {
    super.visit('/register')
  }
  
  fillRegistrationForm(userData: {
    email: string
    password: string
    confirmPassword: string
    firstName: string
    lastName: string
    acceptTerms?: boolean
    subscribeNewsletter?: boolean
  }): void {
    this.typeByTestId(this.selectors.emailInput, userData.email)
    this.typeByTestId(this.selectors.passwordInput, userData.password)
    this.typeByTestId(this.selectors.confirmPasswordInput, userData.confirmPassword)
    this.typeByTestId(this.selectors.firstNameInput, userData.firstName)
    this.typeByTestId(this.selectors.lastNameInput, userData.lastName)
    
    if (userData.acceptTerms !== false) {
      this.getByTestId(this.selectors.termsCheckbox).check()
    }
    
    if (userData.subscribeNewsletter) {
      this.getByTestId(this.selectors.newsletterCheckbox).check()
    }
  }
  
  submitRegistration(): void {
    this.clickByTestId(this.selectors.registerButton)
  }
  
  clickLoginLink(): void {
    this.clickByTestId(this.selectors.loginLink)
  }
  
  expectValidationError(error: string): void {
    this.getByTestId(this.selectors.validationErrors).should('contain', error)
  }
  
  expectPasswordStrength(strength: 'weak' | 'medium' | 'strong'): void {
    this.getByTestId(this.selectors.passwordStrengthIndicator).should('contain', strength)
  }
}