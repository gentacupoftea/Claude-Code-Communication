import { APISettingsPage } from '../support/page-objects'
import { TestDataFactory, TestDataSets } from '../support/test-data'

describe('API Settings Management', () => {
  let apiSettingsPage: APISettingsPage

  beforeEach(() => {
    apiSettingsPage = new APISettingsPage()
    
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }))
    })
    
    // Mock API keys endpoints
    cy.intercept('GET', '**/api/settings/api-keys', {
      statusCode: 200,
      body: {
        apiKeys: TestDataSets.sampleApiKeys
      }
    }).as('getApiKeys')
    
    cy.intercept('POST', '**/api/settings/api-keys', (req) => {
      const newApiKey = {
        id: `api-key-${Date.now()}`,
        ...req.body,
        status: 'active',
        createdAt: new Date().toISOString(),
        usage: {
          requests: 0,
          tokens: 0,
          errors: 0
        }
      }
      req.reply({
        statusCode: 201,
        body: newApiKey
      })
    }).as('addApiKey')
    
    cy.intercept('PUT', '**/api/settings/api-keys/*', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          ...req.body,
          updatedAt: new Date().toISOString()
        }
      })
    }).as('updateApiKey')
    
    cy.intercept('DELETE', '**/api/settings/api-keys/*', {
      statusCode: 204
    }).as('deleteApiKey')
    
    // Mock connection test endpoints
    cy.intercept('POST', '**/api/settings/test-connection/openai', (req) => {
      if (req.body.apiKey.includes('invalid')) {
        req.reply({
          statusCode: 401,
          body: {
            error: 'invalid_api_key',
            message: 'Invalid API key provided'
          }
        })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            status: 'connected',
            model: 'gpt-4-turbo-preview',
            organization: 'test-org',
            rateLimit: {
              requests: 3500,
              tokens: 90000
            }
          }
        })
      }
    }).as('testOpenAIConnection')
    
    cy.intercept('POST', '**/api/settings/test-connection/anthropic', {
      statusCode: 200,
      body: {
        status: 'connected',
        model: 'claude-3-sonnet-20240229',
        rateLimit: {
          requests: 1000,
          tokens: 200000
        }
      }
    }).as('testAnthropicConnection')
    
    cy.intercept('POST', '**/api/settings/test-connection/google', {
      statusCode: 200,
      body: {
        status: 'connected',
        model: 'gemini-pro',
        rateLimit: {
          requests: 1500,
          tokens: 32000
        }
      }
    }).as('testGoogleConnection')
    
    // Mock usage statistics
    cy.intercept('GET', '**/api/settings/usage-stats/*', (req) => {
      const provider = req.url.split('/').pop()
      req.reply({
        statusCode: 200,
        body: {
          provider,
          currentMonth: {
            requests: Math.floor(Math.random() * 1000),
            tokens: Math.floor(Math.random() * 50000),
            cost: Math.floor(Math.random() * 100)
          },
          lastMonth: {
            requests: Math.floor(Math.random() * 800),
            tokens: Math.floor(Math.random() * 40000),
            cost: Math.floor(Math.random() * 80)
          }
        }
      })
    }).as('getUsageStats')
  })

  it('should load API settings with existing keys', () => {
    apiSettingsPage.visit()
    
    // Wait for API keys to load
    cy.wait('@getApiKeys')
    
    // Verify page elements
    apiSettingsPage.getByTestId('add-api-key-button').should('be.visible')
    apiSettingsPage.getByTestId('api-key-list').should('be.visible')
    
    // Verify existing API keys are displayed
    TestDataSets.sampleApiKeys.forEach(apiKey => {
      apiSettingsPage.expectApiKeyExists(apiKey.provider)
      apiSettingsPage.expectConnectionStatus(apiKey.provider, 'connected')
    })
    
    // Verify usage statistics
    TestDataSets.sampleApiKeys.forEach(apiKey => {
      apiSettingsPage.expectRateLimitInfo(apiKey.provider)
    })
  })

  it('should add a new OpenAI API key successfully', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    const newApiKey = TestDataFactory.createTestApiKey({
      provider: 'openai',
      key: 'sk-test-new-openai-key-12345'
    })
    
    // Add new API key
    apiSettingsPage.addApiKey('OpenAI', newApiKey.key)
    
    // Wait for creation request
    cy.wait('@addApiKey').then((interception) => {
      expect(interception.request.body.provider).to.equal('openai')
      expect(interception.request.body.key).to.equal(newApiKey.key)
    })
    
    // Should show success message
    apiSettingsPage.expectSuccessMessage('API key added successfully')
    
    // Should appear in the list
    apiSettingsPage.expectApiKeyExists('openai')
  })

  it('should test API key connection', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Test OpenAI connection
    apiSettingsPage.testConnection('openai')
    
    // Wait for connection test
    cy.wait('@testOpenAIConnection')
    
    // Should show connection success
    apiSettingsPage.expectConnectionStatus('openai', 'connected')
    apiSettingsPage.expectSuccessMessage('Connection test successful')
    
    // Should display API information
    cy.contains('Model: gpt-4-turbo-preview').should('be.visible')
    cy.contains('Organization: test-org').should('be.visible')
    cy.contains('Rate Limit: 3500 requests').should('be.visible')
  })

  it('should handle invalid API key during connection test', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Add invalid API key
    apiSettingsPage.addApiKey('OpenAI', 'sk-invalid-api-key')
    cy.wait('@addApiKey')
    
    // Test connection with invalid key
    apiSettingsPage.testConnection('openai')
    
    // Wait for failed connection test
    cy.wait('@testOpenAIConnection')
    
    // Should show error message
    apiSettingsPage.expectErrorMessage('Invalid API key provided')
    apiSettingsPage.expectConnectionStatus('openai', 'disconnected')
  })

  it('should delete an API key with confirmation', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    const providerToDelete = TestDataSets.sampleApiKeys[0].provider
    
    // Delete API key
    apiSettingsPage.deleteApiKey(providerToDelete)
    
    // Should show confirmation dialog
    cy.contains('Are you sure you want to delete this API key?').should('be.visible')
    apiSettingsPage.clickByTestId('confirm-delete-button')
    
    // Wait for deletion request
    cy.wait('@deleteApiKey')
    
    // Should show success message
    apiSettingsPage.expectSuccessMessage('API key deleted successfully')
    
    // Should be removed from the list
    cy.get(`[data-testid="api-key-item-${providerToDelete}"]`).should('not.exist')
  })

  it('should validate API key format for different providers', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Test invalid OpenAI key format
    apiSettingsPage.clickByTestId('add-api-key-button')
    apiSettingsPage.clickByTestId('api-provider-dropdown')
    cy.contains('OpenAI').click()
    apiSettingsPage.typeByTestId('api-key-input', 'invalid-format')
    apiSettingsPage.clickByTestId('save-api-key-button')
    
    // Should show format error
    apiSettingsPage.expectErrorMessage('OpenAI API keys must start with "sk-"')
    
    // Test invalid Anthropic key format
    apiSettingsPage.getByTestId('api-key-input').clear().type('invalid-anthropic-key')
    apiSettingsPage.clickByTestId('api-provider-dropdown')
    cy.contains('Anthropic').click()
    apiSettingsPage.clickByTestId('save-api-key-button')
    
    // Should show format error
    apiSettingsPage.expectErrorMessage('Anthropic API keys must start with "sk-ant-"')
    
    // Test invalid Google key format
    apiSettingsPage.getByTestId('api-key-input').clear().type('invalid-google-key')
    apiSettingsPage.clickByTestId('api-provider-dropdown')
    cy.contains('Google').click()
    apiSettingsPage.clickByTestId('save-api-key-button')
    
    // Should show format error
    apiSettingsPage.expectErrorMessage('Google API keys must start with "AI"')
  })

  it('should display usage statistics and rate limits', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Click on usage stats for a provider
    cy.get('[data-testid="usage-stats-openai"]').click()
    
    // Wait for usage stats
    cy.wait('@getUsageStats')
    
    // Should display usage information
    cy.contains('Current Month Usage').should('be.visible')
    cy.contains('Requests:').should('be.visible')
    cy.contains('Tokens:').should('be.visible')
    cy.contains('Estimated Cost:').should('be.visible')
    
    // Should display rate limit information
    cy.contains('Rate Limits').should('be.visible')
    cy.contains('Requests per minute').should('be.visible')
    cy.contains('Tokens per minute').should('be.visible')
  })

  it('should handle rate limit warnings', () => {
    // Mock rate limit warning
    cy.intercept('GET', '**/api/settings/rate-limit-status', {
      statusCode: 200,
      body: {
        warnings: [
          {
            provider: 'openai',
            message: 'You have used 90% of your monthly quota',
            severity: 'warning',
            usage: 0.9
          },
          {
            provider: 'anthropic',
            message: 'Rate limit exceeded. Requests throttled.',
            severity: 'error',
            resetTime: Date.now() + 3600000
          }
        ]
      }
    }).as('getRateLimitStatus')
    
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    cy.wait('@getRateLimitStatus')
    
    // Should show rate limit warnings
    cy.contains('You have used 90% of your monthly quota').should('be.visible')
    cy.contains('Rate limit exceeded. Requests throttled.').should('be.visible')
    
    // Should show warning indicators
    cy.get('[data-testid="rate-limit-warning-openai"]').should('be.visible')
    cy.get('[data-testid="rate-limit-error-anthropic"]').should('be.visible')
  })

  it('should manage API key permissions and scopes', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Click on permissions for an API key
    cy.get('[data-testid="manage-permissions-openai"]').click()
    
    // Should show permissions modal
    cy.get('[data-testid="permissions-modal"]').should('be.visible')
    
    // Should show available scopes
    cy.get('[data-testid="scope-chat"]').should('be.visible')
    cy.get('[data-testid="scope-embeddings"]').should('be.visible')
    cy.get('[data-testid="scope-completions"]').should('be.visible')
    
    // Enable/disable scopes
    cy.get('[data-testid="scope-embeddings"]').uncheck()
    cy.get('[data-testid="scope-fine-tuning"]').check()
    
    // Save permissions
    cy.get('[data-testid="save-permissions-button"]').click()
    
    // Should update API key permissions
    cy.wait('@updateApiKey')
    apiSettingsPage.expectSuccessMessage('Permissions updated successfully')
  })

  it('should export and import API key configurations', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Mock export endpoint
    cy.intercept('POST', '**/api/settings/export-config', {
      statusCode: 200,
      body: {
        url: '/downloads/api-config.json',
        filename: 'api-keys-config.json'
      }
    }).as('exportConfig')
    
    // Export configuration
    cy.get('[data-testid="export-config-button"]').click()
    cy.wait('@exportConfig')
    
    // Should show export success
    apiSettingsPage.expectSuccessMessage('Configuration exported successfully')
    
    // Mock import endpoint
    cy.intercept('POST', '**/api/settings/import-config', {
      statusCode: 200,
      body: {
        imported: 3,
        skipped: 1,
        errors: 0
      }
    }).as('importConfig')
    
    // Test import functionality
    cy.get('[data-testid="import-config-button"]').click()
    cy.get('[data-testid="config-file-input"]').selectFile('cypress/fixtures/api-config.json')
    cy.get('[data-testid="confirm-import-button"]').click()
    
    cy.wait('@importConfig')
    apiSettingsPage.expectSuccessMessage('Configuration imported: 3 added, 1 skipped')
  })

  it('should handle API key rotation and renewal', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Mock rotation endpoint
    cy.intercept('POST', '**/api/settings/rotate-key/openai', {
      statusCode: 200,
      body: {
        newKey: 'sk-test-rotated-key-67890',
        oldKeyExpiry: Date.now() + 86400000 // 24 hours
      }
    }).as('rotateApiKey')
    
    // Rotate API key
    cy.get('[data-testid="rotate-key-openai"]').click()
    cy.get('[data-testid="confirm-rotation"]').click()
    
    cy.wait('@rotateApiKey')
    
    // Should show rotation success
    apiSettingsPage.expectSuccessMessage('API key rotated successfully')
    cy.contains('Old key will expire in 24 hours').should('be.visible')
    
    // Should display new key (masked)
    cy.contains('sk-test-****-****-67890').should('be.visible')
  })

  it('should provide security recommendations', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Should show security recommendations
    cy.get('[data-testid="security-recommendations"]').should('be.visible')
    
    // Check for common security recommendations
    cy.contains('Rotate API keys regularly').should('be.visible')
    cy.contains('Use environment variables').should('be.visible')
    cy.contains('Monitor usage patterns').should('be.visible')
    cy.contains('Set up rate limit alerts').should('be.visible')
    
    // Should show security score
    cy.get('[data-testid="security-score"]').should('be.visible')
    cy.contains('Security Score:').should('be.visible')
  })

  it('should handle network errors during API operations', () => {
    // Mock network error for adding API key
    cy.intercept('POST', '**/api/settings/api-keys', {
      forceNetworkError: true
    }).as('networkError')
    
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    // Try to add API key
    apiSettingsPage.addApiKey('OpenAI', 'sk-test-network-error')
    
    // Wait for network error
    cy.wait('@networkError')
    
    // Should show network error message
    apiSettingsPage.expectErrorMessage('Network error. Please check your connection and try again.')
    
    // Should provide retry option
    cy.get('[data-testid="retry-button"]').should('be.visible')
  })

  it('should validate API key length and format requirements', () => {
    apiSettingsPage.visit()
    cy.wait('@getApiKeys')
    
    apiSettingsPage.clickByTestId('add-api-key-button')
    apiSettingsPage.clickByTestId('api-provider-dropdown')
    cy.contains('OpenAI').click()
    
    // Test too short key
    apiSettingsPage.typeByTestId('api-key-input', 'sk-short')
    apiSettingsPage.clickByTestId('save-api-key-button')
    apiSettingsPage.expectErrorMessage('API key is too short')
    
    // Test too long key
    const longKey = 'sk-' + 'a'.repeat(200)
    apiSettingsPage.getByTestId('api-key-input').clear().type(longKey)
    apiSettingsPage.clickByTestId('save-api-key-button')
    apiSettingsPage.expectErrorMessage('API key is too long')
    
    // Test invalid characters
    apiSettingsPage.getByTestId('api-key-input').clear().type('sk-invalid@#$%key')
    apiSettingsPage.clickByTestId('save-api-key-button')
    apiSettingsPage.expectErrorMessage('API key contains invalid characters')
  })
})