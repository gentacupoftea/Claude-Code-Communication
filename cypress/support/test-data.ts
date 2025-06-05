// Test data factories and types for Conea AI Platform E2E tests

// Types for test data
export interface TestUser {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'admin' | 'user' | 'viewer'
  shopDomain?: string
}

export interface TestProject {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface TestApiKey {
  id: string
  provider: 'openai' | 'anthropic' | 'google' | 'shopify'
  key: string
  status: 'active' | 'inactive'
  usage: {
    requests: number
    tokens: number
    errors: number
  }
}

export interface TestShopData {
  id: string
  name: string
  domain: string
  email: string
  plan: string
  products: TestProduct[]
  orders: TestOrder[]
}

export interface TestProduct {
  id: string
  title: string
  description: string
  price: string
  inventory: number
  sales: number
  images: string[]
}

export interface TestOrder {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  currency: string
  customer: {
    firstName: string
    lastName: string
    email: string
  }
  lineItems: Array<{
    title: string
    quantity: number
    price: string
  }>
}

export interface TestChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  provider: 'openai' | 'anthropic' | 'google'
  timestamp: string
  tokens?: number
}

// Test data factories
export class TestDataFactory {
  private static getRandomId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
  
  private static getRandomDate(daysAgo: number = 30): string {
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
    return date.toISOString()
  }
  
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const id = this.getRandomId()
    return {
      id,
      email: `test.user.${id}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      shopDomain: `test-shop-${id}.myshopify.com`,
      ...overrides
    }
  }
  
  static createTestProject(overrides: Partial<TestProject> = {}): TestProject {
    const id = this.getRandomId()
    return {
      id,
      name: `Test Project ${id}`,
      description: `This is a test project for E2E testing purposes. ID: ${id}`,
      status: 'active',
      createdAt: this.getRandomDate(30),
      updatedAt: this.getRandomDate(7),
      ...overrides
    }
  }
  
  static createTestApiKey(overrides: Partial<TestApiKey> = {}): TestApiKey {
    const id = this.getRandomId()
    return {
      id,
      provider: 'openai',
      key: `sk-test-${id}-${Math.random().toString(36).substr(2, 40)}`,
      status: 'active',
      usage: {
        requests: Math.floor(Math.random() * 1000),
        tokens: Math.floor(Math.random() * 100000),
        errors: Math.floor(Math.random() * 10)
      },
      ...overrides
    }
  }
  
  static createTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
    const id = this.getRandomId()
    const products = [
      'Wireless Headphones', 'Smart Watch', 'Laptop Stand', 'Coffee Mug',
      'Notebook Set', 'Desk Lamp', 'Phone Case', 'Water Bottle'
    ]
    const title = products[Math.floor(Math.random() * products.length)]
    
    return {
      id: `gid://shopify/Product/${id}`,
      title: `${title} ${id}`,
      description: `High-quality ${title.toLowerCase()} for your daily needs.`,
      price: (Math.random() * 100 + 10).toFixed(2),
      inventory: Math.floor(Math.random() * 100) + 1,
      sales: Math.floor(Math.random() * 50),
      images: [`https://example.com/images/${id}.jpg`],
      ...overrides
    }
  }
  
  static createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
    const id = this.getRandomId()
    const orderNumber = Math.floor(Math.random() * 9000) + 1000
    const lineItems = [this.createTestOrderLineItem(), this.createTestOrderLineItem()]
    const totalPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
    
    return {
      id: `gid://shopify/Order/${id}`,
      name: `#${orderNumber}`,
      createdAt: this.getRandomDate(7),
      totalPrice: totalPrice.toFixed(2),
      currency: 'USD',
      customer: this.createTestCustomer(),
      lineItems,
      ...overrides
    }
  }
  
  private static createTestOrderLineItem() {
    const products = ['Widget A', 'Widget B', 'Gadget X', 'Tool Y']
    return {
      title: products[Math.floor(Math.random() * products.length)],
      quantity: Math.floor(Math.random() * 3) + 1,
      price: (Math.random() * 50 + 5).toFixed(2)
    }
  }
  
  private static createTestCustomer() {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia']
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    
    return {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
    }
  }
  
  static createTestShopData(overrides: Partial<TestShopData> = {}): TestShopData {
    const id = this.getRandomId()
    return {
      id,
      name: `Test Shop ${id}`,
      domain: `test-shop-${id}.myshopify.com`,
      email: `owner@test-shop-${id}.com`,
      plan: 'Shopify Plus',
      products: Array.from({ length: 5 }, () => this.createTestProduct()),
      orders: Array.from({ length: 10 }, () => this.createTestOrder()),
      ...overrides
    }
  }
  
  static createTestChatMessage(overrides: Partial<TestChatMessage> = {}): TestChatMessage {
    const id = this.getRandomId()
    const messages = [
      'Hello, how can I help you today?',
      'Can you analyze my sales data?',
      'What are the trending products?',
      'Generate a report for last month',
      'How is my inventory doing?'
    ]
    
    return {
      id,
      content: messages[Math.floor(Math.random() * messages.length)],
      role: 'user',
      provider: 'openai',
      timestamp: new Date().toISOString(),
      tokens: Math.floor(Math.random() * 100) + 10,
      ...overrides
    }
  }
  
  // Bulk data generators
  static createTestUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
    return Array.from({ length: count }, () => this.createTestUser(overrides))
  }
  
  static createTestProjects(count: number, overrides: Partial<TestProject> = {}): TestProject[] {
    return Array.from({ length: count }, () => this.createTestProject(overrides))
  }
  
  static createTestApiKeys(count: number, overrides: Partial<TestApiKey> = {}): TestApiKey[] {
    return Array.from({ length: count }, () => this.createTestApiKey(overrides))
  }
  
  static createTestProducts(count: number, overrides: Partial<TestProduct> = {}): TestProduct[] {
    return Array.from({ length: count }, () => this.createTestProduct(overrides))
  }
  
  static createTestOrders(count: number, overrides: Partial<TestOrder> = {}): TestOrder[] {
    return Array.from({ length: count }, () => this.createTestOrder(overrides))
  }
}

// Pre-defined test data sets
export const TestDataSets = {
  // Admin user for testing admin features
  adminUser: TestDataFactory.createTestUser({
    email: 'admin@conea.ai',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  }),
  
  // Regular user for standard feature testing
  regularUser: TestDataFactory.createTestUser({
    email: 'user@conea.ai',
    role: 'user',
    firstName: 'Regular',
    lastName: 'User'
  }),
  
  // Viewer user for read-only testing
  viewerUser: TestDataFactory.createTestUser({
    email: 'viewer@conea.ai',
    role: 'viewer',
    firstName: 'Viewer',
    lastName: 'User'
  }),
  
  // Sample projects for project management testing
  sampleProjects: [
    TestDataFactory.createTestProject({
      name: 'E-commerce Analytics',
      description: 'Comprehensive analytics dashboard for e-commerce data',
      status: 'active'
    }),
    TestDataFactory.createTestProject({
      name: 'Inventory Management',
      description: 'Smart inventory tracking and optimization system',
      status: 'active'
    }),
    TestDataFactory.createTestProject({
      name: 'Customer Insights',
      description: 'AI-powered customer behavior analysis',
      status: 'inactive'
    })
  ],
  
  // Sample API keys for API management testing
  sampleApiKeys: [
    TestDataFactory.createTestApiKey({
      provider: 'openai',
      key: 'sk-test-openai-key-12345'
    }),
    TestDataFactory.createTestApiKey({
      provider: 'anthropic',
      key: 'sk-ant-api03-test-key-67890'
    }),
    TestDataFactory.createTestApiKey({
      provider: 'google',
      key: 'AItest-google-key-abcdef'
    })
  ],
  
  // Sample dashboard data
  sampleDashboardData: {
    totalOrders: 120,
    totalSales: '$9,876.54',
    averageOrderValue: '$82.30',
    conversionRate: '3.2%',
    topProducts: TestDataFactory.createTestProducts(3),
    recentOrders: TestDataFactory.createTestOrders(5)
  },
  
  // Sample chat messages for MultiLLM testing
  sampleChatMessages: [
    TestDataFactory.createTestChatMessage({
      content: 'Hello, I need help analyzing my sales data',
      role: 'user',
      provider: 'openai'
    }),
    TestDataFactory.createTestChatMessage({
      content: 'I can help you analyze your sales data. What specific metrics would you like to focus on?',
      role: 'assistant',
      provider: 'openai'
    }),
    TestDataFactory.createTestChatMessage({
      content: 'Show me the top performing products this month',
      role: 'user',
      provider: 'anthropic'
    })
  ]
}

// Utility functions for test data management
export class TestDataUtils {
  static saveTestData(key: string, data: any): void {
    cy.writeFile(`cypress/fixtures/test-data/${key}.json`, data)
  }
  
  static loadTestData(key: string): Cypress.Chainable<any> {
    return cy.readFile(`cypress/fixtures/test-data/${key}.json`)
  }
  
  static clearTestData(): void {
    cy.task('clearDatabase')
  }
  
  static seedDatabase(data: any): void {
    cy.task('seedDatabase', data)
  }
  
  static resetToCleanState(): void {
    cy.clearLocalStorage()
    cy.clearCookies()
    this.clearTestData()
  }
}