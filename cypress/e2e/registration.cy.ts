import { RegistrationPage } from '../support/page-objects'
import { TestDataFactory } from '../support/test-data'

describe('User Registration Flow', () => {
  let registrationPage: RegistrationPage

  beforeEach(() => {
    registrationPage = new RegistrationPage()
    
    // Clear authentication state
    cy.clearCookies()
    cy.clearLocalStorage()
    
    // Mock registration API
    cy.intercept('POST', '**/auth/register', (req) => {
      if (req.body.email === 'existing@example.com') {
        req.reply({
          statusCode: 409,
          body: {
            error: 'email_exists',
            message: 'An account with this email already exists'
          }
        })
      } else if (req.body.password === 'weak') {
        req.reply({
          statusCode: 400,
          body: {
            error: 'password_too_weak',
            message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
          }
        })
      } else {
        req.reply({
          statusCode: 201,
          body: {
            user: {
              id: 'user-123',
              email: req.body.email,
              firstName: req.body.firstName,
              lastName: req.body.lastName
            },
            token: 'jwt-token-here'
          }
        })
      }
    }).as('registerRequest')
    
    // Mock email verification endpoint
    cy.intercept('POST', '**/auth/send-verification', {
      statusCode: 200,
      body: { message: 'Verification email sent' }
    }).as('verificationRequest')
  })

  it('should display registration form with all fields', () => {
    registrationPage.visit()
    
    // Verify form elements are present
    registrationPage.getByTestId('email-input').should('be.visible')
    registrationPage.getByTestId('password-input').should('be.visible')
    registrationPage.getByTestId('confirm-password-input').should('be.visible')
    registrationPage.getByTestId('first-name-input').should('be.visible')
    registrationPage.getByTestId('last-name-input').should('be.visible')
    registrationPage.getByTestId('terms-checkbox').should('be.visible')
    registrationPage.getByTestId('register-button').should('be.visible')
    
    // Verify helper texts and links
    cy.contains('Already have an account?').should('be.visible')
    registrationPage.getByTestId('login-link').should('be.visible')
    cy.contains('By creating an account, you agree to our').should('be.visible')
  })

  it('should validate required fields', () => {
    registrationPage.visit()
    
    // Try to submit empty form
    registrationPage.submitRegistration()
    
    // Check validation errors
    registrationPage.expectValidationError('Email is required')
    registrationPage.expectValidationError('Password is required')
    registrationPage.expectValidationError('First name is required')
    registrationPage.expectValidationError('Last name is required')
    registrationPage.expectValidationError('You must accept the terms and conditions')
  })

  it('should validate email format', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      email: 'invalid-email-format'
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    registrationPage.expectValidationError('Please enter a valid email address')
  })

  it('should validate password strength', () => {
    registrationPage.visit()
    
    // Test weak password
    registrationPage.typeByTestId('password-input', 'weak')
    registrationPage.expectPasswordStrength('weak')
    
    // Test medium password
    registrationPage.getByTestId('password-input').clear().type('Password123')
    registrationPage.expectPasswordStrength('medium')
    
    // Test strong password
    registrationPage.getByTestId('password-input').clear().type('StrongPassword123!')
    registrationPage.expectPasswordStrength('strong')
  })

  it('should validate password confirmation', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      password: 'TestPassword123!',
      confirmPassword: 'DifferentPassword123!'
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    registrationPage.expectValidationError('Passwords do not match')
  })

  it('should successfully register a new user', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      email: 'newuser@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe'
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Wait for registration request
    cy.wait('@registerRequest')
    
    // Should redirect to dashboard or verification page
    cy.url().should('match', /\/(dashboard|verify-email)/)
    
    // Check success message
    registrationPage.expectSuccessMessage('Account created successfully')
  })

  it('should handle registration with existing email', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      email: 'existing@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Wait for failed registration request
    cy.wait('@registerRequest')
    
    // Should show error message
    registrationPage.expectErrorMessage('An account with this email already exists')
    
    // Should stay on registration page
    cy.url().should('include', '/register')
  })

  it('should handle weak password rejection', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      password: 'weak',
      confirmPassword: 'weak'
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Wait for failed registration request
    cy.wait('@registerRequest')
    
    // Should show password strength error
    registrationPage.expectErrorMessage('Password must be at least 8 characters with uppercase, lowercase, and numbers')
  })

  it('should navigate to login page from registration', () => {
    registrationPage.visit()
    
    registrationPage.clickLoginLink()
    
    // Should navigate to login page
    cy.url().should('include', '/login')
    cy.contains('Sign in to your account').should('be.visible')
  })

  it('should handle terms and conditions requirement', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser({
      acceptTerms: false // Don't accept terms
    })
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Should show terms error
    registrationPage.expectValidationError('You must accept the terms and conditions')
    
    // Accept terms and try again
    registrationPage.getByTestId('terms-checkbox').check()
    registrationPage.submitRegistration()
    
    // Should proceed with registration
    cy.wait('@registerRequest')
  })

  it('should show loading state during registration', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser()
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Should show loading state
    registrationPage.getByTestId('register-button').should('be.disabled')
    registrationPage.getByTestId('register-button').should('contain', 'Creating account...')
    
    // Wait for completion
    cy.wait('@registerRequest')
    
    // Button should be enabled again
    registrationPage.getByTestId('register-button').should('not.be.disabled')
  })

  it('should send verification email after successful registration', () => {
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser()
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Wait for registration
    cy.wait('@registerRequest')
    
    // Should trigger verification email
    cy.wait('@verificationRequest')
    
    // Should show verification message
    cy.contains('Please check your email to verify your account').should('be.visible')
  })

  it('should handle network errors during registration', () => {
    // Mock network error
    cy.intercept('POST', '**/auth/register', {
      forceNetworkError: true
    }).as('networkError')
    
    registrationPage.visit()
    
    const userData = TestDataFactory.createTestUser()
    
    registrationPage.fillRegistrationForm(userData)
    registrationPage.submitRegistration()
    
    // Wait for network error
    cy.wait('@networkError')
    
    // Should show network error message
    registrationPage.expectErrorMessage('Network error. Please check your connection and try again.')
  })

  it('should validate form fields in real-time', () => {
    registrationPage.visit()
    
    // Test email validation
    registrationPage.typeByTestId('email-input', 'invalid')
    registrationPage.getByTestId('email-input').blur()
    registrationPage.expectValidationError('Please enter a valid email address')
    
    // Fix email
    registrationPage.getByTestId('email-input').clear().type('valid@example.com')
    registrationPage.getByTestId('email-input').blur()
    cy.get('[data-testid="validation-errors"]').should('not.contain', 'Please enter a valid email address')
    
    // Test password confirmation
    registrationPage.typeByTestId('password-input', 'TestPassword123!')
    registrationPage.typeByTestId('confirm-password-input', 'Different')
    registrationPage.getByTestId('confirm-password-input').blur()
    registrationPage.expectValidationError('Passwords do not match')
    
    // Fix password confirmation
    registrationPage.getByTestId('confirm-password-input').clear().type('TestPassword123!')
    registrationPage.getByTestId('confirm-password-input').blur()
    cy.get('[data-testid="validation-errors"]').should('not.contain', 'Passwords do not match')
  })
})