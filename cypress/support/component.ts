// Cypress Component Testing support file
// This file is processed and loaded automatically before component test files

import './commands'

// Import global styles for component testing
import '../../app/globals.css'

// Add custom component testing utilities
import { mount } from 'cypress/react'

// Augment the Cypress namespace to include type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
      // Add any component-specific commands here
      renderWithProviders(component: React.ReactElement, options?: any): Chainable<any>
    }
  }
}

// Make mount available globally
Cypress.Commands.add('mount', mount)

// Custom command for mounting components with providers
Cypress.Commands.add('renderWithProviders', (component: React.ReactElement, options = {}) => {
  const { 
    initialState = {},
    theme = 'dark',
    router = true 
  } = options

  // Wrapper component with necessary providers
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <div data-theme={theme}>
        {children}
      </div>
    )
  }

  return cy.mount(
    <Wrapper>
      {component}
    </Wrapper>
  )
})

// Configure component testing environment
beforeEach(() => {
  // Set up any global state or mocks needed for component tests
  cy.viewport(1280, 720)
})

// Global error handling for component tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions in component tests
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false
  }
  return true
})