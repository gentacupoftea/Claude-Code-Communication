// Cypress E2E support file
// Import commands.ts using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that are not related to the test
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false
  }
  return true
})

// Add custom assertions
chai.use((chai, utils) => {
  chai.Assertion.addMethod('haveTestId', function (expected) {
    const subject = this._obj
    const actual = subject.attr('data-testid')
    
    this.assert(
      actual === expected,
      `expected element to have data-testid "${expected}" but got "${actual}"`,
      `expected element not to have data-testid "${expected}"`,
      expected,
      actual
    )
  })
})

// Global before hook
beforeEach(() => {
  // Clear application state
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Set up default viewport
  cy.viewport(1280, 720)
})

// Global after hook
afterEach(() => {
  // Take screenshot on failure
  if (cy.state('test').state === 'failed') {
    const testTitle = cy.state('test').title
    const specName = Cypress.spec.name
    cy.screenshot(`${specName}-${testTitle}`)
  }
})