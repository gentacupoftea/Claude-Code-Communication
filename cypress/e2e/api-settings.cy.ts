import { APISettingsPage } from '../support/page-objects'
import { TestDataFactory, TestDataSets } from '../support/test-data'

describe('API Settings Management', () => {
  let apiSettingsPage: APISettingsPage

  beforeEach(() => {
    apiSettingsPage = new APISettingsPage()
    
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('authToken', 'demo-token-123456')
    })
  })

  it('should load API settings page', () => {
    apiSettingsPage.visit()
    
    // Verify page loaded
    cy.waitForText('API設定')
    
    // Verify API key input field exists
    apiSettingsPage.getByTestId('api-key-input').should('be.visible')
    apiSettingsPage.getByTestId('api-key-input').should('have.attr', 'type', 'password')
    apiSettingsPage.getByTestId('api-key-input').should('have.value', 'sk-xxxxxxxxxxxxxxxx')
    
    // Verify regenerate button exists
    apiSettingsPage.getByTestId('save-api-key-button').should('be.visible')
    apiSettingsPage.getByTestId('save-api-key-button').should('contain', '再生成')
  })

  it('should handle clicking regenerate button', () => {
    apiSettingsPage.visit()
    
    // Wait for page to load
    cy.waitForText('API設定')
    
    // Click regenerate button
    apiSettingsPage.getByTestId('save-api-key-button').click()
    
    // In demo mode, button click doesn't do anything special
    // Just verify the button is still there and clickable
    apiSettingsPage.getByTestId('save-api-key-button').should('be.visible')
  })

  it('should maintain API key field as read-only', () => {
    apiSettingsPage.visit()
    
    // Wait for page to load
    cy.waitForText('API設定')
    
    // Verify API key input is read-only
    apiSettingsPage.getByTestId('api-key-input').should('have.attr', 'readonly')
    
    // Verify the field has the default masked value
    apiSettingsPage.getByTestId('api-key-input').should('have.value', 'sk-xxxxxxxxxxxxxxxx')
  })

  it('should display API section within settings page', () => {
    apiSettingsPage.visit()
    
    // Verify we're on the settings page
    cy.url().should('include', '/settings')
    
    // Verify other settings sections are visible
    cy.contains('プロフィール設定').should('be.visible')
    cy.contains('通知設定').should('be.visible')
    cy.contains('セキュリティ').should('be.visible')
    cy.contains('API設定').should('be.visible')
    cy.contains('言語・地域設定').should('be.visible')
    
    // Verify API section has the Key icon
    cy.get('.w-6.h-6.text-\\[\\#1ABC9C\\]').should('exist')
  })
})