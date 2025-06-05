// Accessibility (a11y) tests for Conea AI Platform
// Ensures WCAG 2.1 AA compliance and inclusive design

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Set up authentication for protected pages
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }))
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support tab navigation on login page', () => {
      cy.visit('/login')
      cy.waitForPageLoad()
      
      // Test tab order
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'email-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'password-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'login-button')
      
      // Test shift+tab (reverse navigation)
      cy.focused().tab({ shift: true })
      cy.focused().should('have.attr', 'data-testid', 'password-input')
    })

    it('should support keyboard form submission', () => {
      cy.visit('/login')
      cy.waitForPageLoad()
      
      // Mock login API
      cy.mockApiResponse('auth/login', {
        accessToken: 'test-token',
        user: { email: 'test@example.com' }
      }, 'loginRequest')
      
      // Fill form using keyboard only
      cy.getByTestId('email-input').type('test@example.com')
      cy.getByTestId('password-input').type('password123')
      
      // Submit using Enter key
      cy.getByTestId('password-input').type('{enter}')
      
      cy.waitForApiResponse('@loginRequest')
      cy.url().should('include', '/dashboard')
    })

    it('should support escape key for modal dismissal', () => {
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      // Open create project modal
      cy.getByTestId('create-project-button').click()
      cy.getByTestId('project-modal').should('be.visible')
      
      // Close with escape key
      cy.get('body').type('{esc}')
      cy.getByTestId('project-modal').should('not.exist')
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels on form inputs', () => {
      cy.visit('/login')
      cy.waitForPageLoad()
      
      // Check for ARIA labels
      cy.getByTestId('email-input')
        .should('have.attr', 'aria-label')
        .and('contain', 'Email address')
      
      cy.getByTestId('password-input')
        .should('have.attr', 'aria-label')
        .and('contain', 'Password')
      
      cy.getByTestId('login-button')
        .should('have.attr', 'aria-label')
        .and('contain', 'Sign in to account')
    })

    it('should have descriptive alt text for images', () => {
      cy.visit('/')
      cy.waitForPageLoad()
      
      // Check logo alt text
      cy.get('img[alt]').each(($img) => {
        cy.wrap($img)
          .should('have.attr', 'alt')
          .and('not.be.empty')
          .and('not.equal', 'image') // Avoid generic alt text
      })
    })

    it('should announce loading states to screen readers', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Check for ARIA live regions
      cy.get('[aria-live="polite"]').should('exist')
      cy.get('[aria-live="assertive"]').should('exist')
      
      // Test loading announcement
      cy.getByTestId('refresh-dashboard-btn').click()
      cy.get('[aria-live="polite"]').should('contain', 'Loading')
    })
  })

  describe('Color and Contrast', () => {
    it('should maintain readability with high contrast mode', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Simulate high contrast mode
      cy.get('body').invoke('addClass', 'high-contrast')
      
      // Check that text is still readable
      cy.get('h1, h2, h3, p, span').each(($el) => {
        cy.wrap($el).should('be.visible')
      })
    })

    it('should not rely solely on color for information', () => {
      cy.visit('/api-settings')
      cy.waitForPageLoad()
      
      // Check that status indicators have text or icons, not just color
      cy.get('[data-testid*="connection-status"]').each(($status) => {
        cy.wrap($status).should(($el) => {
          const text = $el.text()
          const hasIcon = $el.find('[data-testid*="icon"]').length > 0
          expect(text.length > 0 || hasIcon).to.be.true
        })
      })
    })
  })

  describe('Focus Management', () => {
    it('should trap focus within modals', () => {
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      // Open modal
      cy.getByTestId('create-project-button').click()
      cy.getByTestId('project-modal').should('be.visible')
      
      // Tab through modal elements
      cy.get('body').tab()
      cy.focused().should('be.within', '[data-testid="project-modal"]')
      
      // Continue tabbing - should stay within modal
      for (let i = 0; i < 10; i++) {
        cy.focused().tab()
        cy.focused().should('be.within', '[data-testid="project-modal"]')
      }
    })

    it('should restore focus after modal closure', () => {
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      // Focus on create button
      cy.getByTestId('create-project-button').focus()
      cy.focused().should('have.attr', 'data-testid', 'create-project-button')
      
      // Open and close modal
      cy.getByTestId('create-project-button').click()
      cy.getByTestId('cancel-project-button').click()
      
      // Focus should return to create button
      cy.focused().should('have.attr', 'data-testid', 'create-project-button')
    })
  })

  describe('Text and Typography', () => {
    it('should be readable when zoomed to 200%', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Simulate 200% zoom
      cy.viewport(640, 360) // Half the normal viewport
      
      // Check that content is still accessible
      cy.get('h1').should('be.visible')
      cy.getByTestId('navigation-menu').should('be.visible')
      
      // Check that horizontal scrolling is not required
      cy.get('body').invoke('outerWidth').should('be.lte', 640)
    })

    it('should respect user font size preferences', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Simulate larger font size preference
      cy.get('html').invoke('css', 'font-size', '20px')
      
      // Verify text scales proportionally
      cy.get('body').should('have.css', 'font-size').and('not.equal', '16px')
    })
  })

  describe('Error and Success Messages', () => {
    it('should announce errors to screen readers', () => {
      cy.visit('/login')
      cy.waitForPageLoad()
      
      // Mock login error
      cy.mockApiError('auth/login', 401, {
        error: 'invalid_credentials',
        message: 'Invalid email or password'
      }, 'loginError')
      
      // Attempt login
      cy.getByTestId('email-input').type('test@example.com')
      cy.getByTestId('password-input').type('wrongpassword')
      cy.getByTestId('login-button').click()
      
      cy.waitForApiResponse('@loginError')
      
      // Check that error is announced
      cy.get('[role="alert"]').should('be.visible')
      cy.get('[aria-live="assertive"]').should('contain', 'Invalid email or password')
    })

    it('should provide clear error instructions', () => {
      cy.visit('/registration')
      cy.waitForPageLoad()
      
      // Submit form with validation errors
      cy.getByTestId('register-button').click()
      
      // Check that errors are descriptive and actionable
      cy.get('[data-testid="validation-errors"]').within(() => {
        cy.contains('Email is required').should('be.visible')
        cy.contains('Password is required').should('be.visible')
      })
      
      // Errors should be associated with form fields
      cy.getByTestId('email-input').should('have.attr', 'aria-describedby')
      cy.getByTestId('password-input').should('have.attr', 'aria-describedby')
    })
  })

  describe('Interactive Elements', () => {
    it('should have sufficient click target sizes', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Check that interactive elements meet minimum size requirements (44x44px)
      cy.get('button, a, [role="button"]').each(($el) => {
        cy.wrap($el).should(($element) => {
          const rect = $element[0].getBoundingClientRect()
          expect(rect.width).to.be.at.least(44)
          expect(rect.height).to.be.at.least(44)
        })
      })
    })

    it('should provide clear focus indicators', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Tab to interactive elements and check focus visibility
      cy.get('button, a, input').each(($el) => {
        cy.wrap($el).focus()
        cy.focused().should('have.css', 'outline').and('not.equal', 'none')
      })
    })
  })

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', () => {
      cy.viewport('iphone-6')
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Check that navigation is accessible on mobile
      cy.get('[data-testid="mobile-menu-button"]').should('be.visible')
      cy.get('[data-testid="mobile-menu-button"]').should('have.attr', 'aria-label')
      
      // Test mobile menu functionality
      cy.get('[data-testid="mobile-menu-button"]').click()
      cy.get('[data-testid="mobile-navigation"]').should('be.visible')
      cy.get('[data-testid="mobile-navigation"]').should('have.attr', 'aria-expanded', 'true')
    })

    it('should support touch gestures appropriately', () => {
      cy.viewport('ipad-2')
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      // Test that swipe gestures don't interfere with accessibility
      cy.get('[data-testid="project-list"]').should('be.visible')
      
      // Touch targets should be appropriately spaced
      cy.get('[data-testid="project-item"]').then(($items) => {
        if ($items.length > 1) {
          const first = $items[0].getBoundingClientRect()
          const second = $items[1].getBoundingClientRect()
          const spacing = Math.abs(second.top - first.bottom)
          expect(spacing).to.be.at.least(8) // Minimum 8px spacing
        }
      })
    })
  })

  describe('Language and Internationalization', () => {
    it('should have proper lang attributes', () => {
      cy.visit('/')
      cy.waitForPageLoad()
      
      // Check document language
      cy.get('html').should('have.attr', 'lang')
      
      // Check for language changes in content
      cy.get('[lang]').each(($el) => {
        cy.wrap($el).should('have.attr', 'lang').and('not.be.empty')
      })
    })

    it('should handle text direction changes', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Test RTL layout (for Arabic/Hebrew support)
      cy.get('html').invoke('attr', 'dir', 'rtl')
      
      // Verify layout adjusts appropriately
      cy.get('[data-testid="sidebar"]').should('be.visible')
      cy.get('[data-testid="main-content"]').should('be.visible')
    })
  })
})