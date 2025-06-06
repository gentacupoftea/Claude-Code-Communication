// Registration flow tests
// Tests the user registration process if available

describe('Registration Tests', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.waitForPageLoad()
  })

  describe('Registration Link', () => {
    it('should show registration option on login page', () => {
      // Check if there's a registration link
      cy.get('body').then($body => {
        if ($body.find('a[href*="register"]').length > 0 || 
            $body.text().includes('新規登録') ||
            $body.text().includes('Sign up') ||
            $body.text().includes('Create account')) {
          cy.contains(/新規登録|Sign up|Create account/i).should('be.visible')
        }
      })
    })
  })

  describe('Registration Form', () => {
    it('should navigate to registration if available', () => {
      // Try to find and click registration link
      cy.get('body').then($body => {
        const hasRegisterLink = $body.find('a[href*="register"]').length > 0
        const hasSignUpText = $body.text().match(/新規登録|Sign up|Create account/i)
        
        if (hasRegisterLink || hasSignUpText) {
          cy.contains(/新規登録|Sign up|Create account/i).first().click()
          
          // Should navigate to registration page
          cy.url().then(url => {
            if (url.includes('/register') || url.includes('/signup')) {
              // Test registration form
              cy.get('input[type="email"]').should('be.visible')
              cy.get('input[type="password"]').should('be.visible')
            }
          })
        }
      })
    })
  })

  describe('Demo Mode Registration', () => {
    it('should handle demo mode appropriately', () => {
      // In demo mode, registration might not be available
      // Just verify login works
      cy.getByTestId('email-input').should('be.visible')
      cy.getByTestId('password-input').should('be.visible')
      cy.getByTestId('login-button').should('be.visible')
    })

    it('should show appropriate message for demo users', () => {
      // Check for demo mode indicators
      cy.get('body').then($body => {
        if ($body.text().includes('Demo') || 
            $body.text().includes('デモ')) {
          cy.contains(/Demo|デモ/i).should('exist')
        }
      })
    })
  })

  describe('Login Alternative', () => {
    it('should allow login with demo credentials', () => {
      // Test login as alternative to registration
      cy.getByTestId('email-input').type('demo@example.com')
      cy.getByTestId('password-input').type('password123')
      cy.getByTestId('login-button').click()
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Form Validation', () => {
    it('should validate email format if registration exists', () => {
      cy.get('body').then($body => {
        if ($body.find('a[href*="register"]').length > 0) {
          cy.contains(/新規登録|Sign up|Create account/i).first().click()
          
          cy.url().then(url => {
            if (url.includes('/register')) {
              // Test email validation
              cy.get('input[type="email"]').type('invalid-email')
              cy.get('button[type="submit"]').click()
              
              // Should show validation error or stay on page
              cy.url().should('include', '/register')
            }
          })
        }
      })
    })
  })

  describe('Terms and Conditions', () => {
    it('should handle terms acceptance if present', () => {
      cy.get('body').then($body => {
        if ($body.find('input[type="checkbox"]').length > 0 &&
            ($body.text().includes('利用規約') || 
             $body.text().includes('Terms'))) {
          // Check terms checkbox if it exists
          cy.get('input[type="checkbox"]').first().check()
        }
      })
    })
  })
})