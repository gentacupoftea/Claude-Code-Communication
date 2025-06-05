// Enhanced error simulation utilities for comprehensive E2E testing

export type NetworkErrorType = 
  | 'timeout' 
  | 'connection_reset' 
  | 'dns_failure' 
  | 'ssl_error'
  | 'intermittent_failure'
  | 'slow_response'

export type APIErrorType = 
  | 'rate_limit'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'service_unavailable'
  | 'validation_error'
  | 'authentication_failed'

export class ErrorSimulator {
  /**
   * Simulate network-level errors
   */
  static simulateNetworkError(type: NetworkErrorType, endpoint: string, alias?: string) {
    const aliasName = alias || `${type}_error`

    switch (type) {
      case 'timeout':
        return cy.intercept('**/' + endpoint, (req) => {
          req.reply((res) => {
            res.delay(30000) // Force timeout
          })
        }).as(aliasName)

      case 'connection_reset':
        return cy.intercept('**/' + endpoint, {
          forceNetworkError: true
        }).as(aliasName)

      case 'dns_failure':
        return cy.intercept('**/' + endpoint, (req) => {
          req.destroy()
        }).as(aliasName)

      case 'ssl_error':
        return cy.intercept('**/' + endpoint, {
          statusCode: 526,
          body: { error: 'SSL handshake failed' }
        }).as(aliasName)

      case 'intermittent_failure':
        let requestCount = 0
        return cy.intercept('**/' + endpoint, (req) => {
          requestCount++
          if (requestCount % 3 === 0) {
            req.reply({ forceNetworkError: true })
          } else {
            req.continue()
          }
        }).as(aliasName)

      case 'slow_response':
        return cy.intercept('**/' + endpoint, (req) => {
          req.reply((res) => {
            res.delay(5000) // 5 second delay
            res.send(200, { message: 'Slow response' })
          })
        }).as(aliasName)

      default:
        throw new Error(`Unknown network error type: ${type}`)
    }
  }

  /**
   * Simulate API-specific errors
   */
  static simulateAPIError(type: APIErrorType, endpoint: string, alias?: string) {
    const aliasName = alias || `${type}_error`

    switch (type) {
      case 'rate_limit':
        return cy.intercept('**/' + endpoint, {
          statusCode: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600,
            'Retry-After': '3600'
          },
          body: {
            error: 'rate_limit_exceeded',
            message: 'API rate limit exceeded',
            retryAfter: 3600
          }
        }).as(aliasName)

      case 'invalid_api_key':
        return cy.intercept('**/' + endpoint, {
          statusCode: 401,
          body: {
            error: 'invalid_api_key',
            message: 'The API key provided is invalid',
            code: 'INVALID_KEY'
          }
        }).as(aliasName)

      case 'quota_exceeded':
        return cy.intercept('**/' + endpoint, {
          statusCode: 402,
          body: {
            error: 'quota_exceeded',
            message: 'Monthly quota exceeded',
            currentUsage: 10000,
            limit: 10000,
            resetDate: '2024-07-01T00:00:00Z'
          }
        }).as(aliasName)

      case 'service_unavailable':
        return cy.intercept('**/' + endpoint, {
          statusCode: 503,
          headers: {
            'Retry-After': '300'
          },
          body: {
            error: 'service_unavailable',
            message: 'Service temporarily unavailable',
            estimatedRecoveryTime: '5 minutes'
          }
        }).as(aliasName)

      case 'validation_error':
        return cy.intercept('**/' + endpoint, {
          statusCode: 400,
          body: {
            error: 'validation_error',
            message: 'Request validation failed',
            details: [
              {
                field: 'email',
                code: 'INVALID_FORMAT',
                message: 'Email format is invalid'
              },
              {
                field: 'password',
                code: 'TOO_SHORT',
                message: 'Password must be at least 8 characters'
              }
            ]
          }
        }).as(aliasName)

      case 'authentication_failed':
        return cy.intercept('**/' + endpoint, {
          statusCode: 401,
          body: {
            error: 'authentication_failed',
            message: 'Authentication credentials are invalid',
            code: 'AUTH_FAILED'
          }
        }).as(aliasName)

      default:
        throw new Error(`Unknown API error type: ${type}`)
    }
  }

  /**
   * Simulate memory and performance issues
   */
  static simulatePerformanceIssues(type: 'memory_leak' | 'cpu_spike' | 'slow_rendering') {
    switch (type) {
      case 'memory_leak':
        cy.window().then((win) => {
          // Simulate memory leak by creating large objects
          const leakArray: any[] = []
          for (let i = 0; i < 1000; i++) {
            leakArray.push(new Array(1000).fill('memory-leak-data'))
          }
          // Store in global variable to prevent garbage collection
          ;(win as any).memoryLeak = leakArray
        })
        break

      case 'cpu_spike':
        cy.window().then((win) => {
          // Simulate CPU intensive operation
          const startTime = Date.now()
          while (Date.now() - startTime < 2000) {
            Math.random() * Math.random()
          }
        })
        break

      case 'slow_rendering':
        cy.get('body').then(($body) => {
          // Add CSS animation that slows down rendering
          $body.append(`
            <style>
              .slow-animation {
                animation: slowSpin 10s linear infinite;
              }
              @keyframes slowSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            </style>
          `)
          $body.addClass('slow-animation')
        })
        break
    }
  }

  /**
   * Simulate browser-specific issues
   */
  static simulateBrowserIssues(type: 'localStorage_full' | 'cookie_disabled' | 'javascript_error') {
    switch (type) {
      case 'localStorage_full':
        cy.window().then((win) => {
          try {
            // Fill localStorage to capacity
            const largeString = new Array(1024 * 1024).join('x') // 1MB string
            for (let i = 0; i < 100; i++) {
              win.localStorage.setItem(`large_item_${i}`, largeString)
            }
          } catch (e) {
            // Expected to fail when storage is full
          }
        })
        break

      case 'cookie_disabled':
        cy.window().then((win) => {
          // Mock document.cookie to simulate disabled cookies
          Object.defineProperty(win.document, 'cookie', {
            get: () => '',
            set: () => false
          })
        })
        break

      case 'javascript_error':
        cy.window().then((win) => {
          // Inject a JavaScript error
          win.setTimeout(() => {
            throw new Error('Simulated JavaScript error for testing')
          }, 1000)
        })
        break
    }
  }

  /**
   * Recovery testing - test system resilience
   */
  static testRecovery(errorType: NetworkErrorType | APIErrorType, endpoint: string) {
    const alias = `${errorType}_recovery_test`
    
    // First simulate the error
    if (['timeout', 'connection_reset', 'dns_failure', 'ssl_error', 'intermittent_failure', 'slow_response'].includes(errorType)) {
      this.simulateNetworkError(errorType as NetworkErrorType, endpoint, `${alias}_error`)
    } else {
      this.simulateAPIError(errorType as APIErrorType, endpoint, `${alias}_error`)
    }

    // Then set up recovery intercept
    cy.intercept('**/' + endpoint, {
      statusCode: 200,
      body: { status: 'recovered', message: 'Service is now available' }
    }).as(`${alias}_success`)

    return {
      errorAlias: `${alias}_error`,
      successAlias: `${alias}_success`
    }
  }
}

// Add error simulation commands to Cypress
declare global {
  namespace Cypress {
    interface Chainable {
      simulateNetworkError(type: NetworkErrorType, endpoint: string, alias?: string): Chainable<null>
      simulateAPIError(type: APIErrorType, endpoint: string, alias?: string): Chainable<null>
      simulatePerformanceIssues(type: 'memory_leak' | 'cpu_spike' | 'slow_rendering'): Chainable<null>
      simulateBrowserIssues(type: 'localStorage_full' | 'cookie_disabled' | 'javascript_error'): Chainable<null>
      testRecovery(errorType: NetworkErrorType | APIErrorType, endpoint: string): Chainable<{errorAlias: string, successAlias: string}>
    }
  }
}

Cypress.Commands.add('simulateNetworkError', ErrorSimulator.simulateNetworkError)
Cypress.Commands.add('simulateAPIError', ErrorSimulator.simulateAPIError)
Cypress.Commands.add('simulatePerformanceIssues', ErrorSimulator.simulatePerformanceIssues)
Cypress.Commands.add('simulateBrowserIssues', ErrorSimulator.simulateBrowserIssues)
Cypress.Commands.add('testRecovery', ErrorSimulator.testRecovery)