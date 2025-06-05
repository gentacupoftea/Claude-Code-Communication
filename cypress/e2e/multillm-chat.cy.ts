import { MultiLLMChatPage } from '../support/page-objects'
import { TestDataFactory, TestDataSets } from '../support/test-data'

describe('MultiLLM Chat Interface', () => {
  let chatPage: MultiLLMChatPage

  beforeEach(() => {
    chatPage = new MultiLLMChatPage()
    
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }))
    })
    
    // Mock LLM provider APIs
    cy.intercept('POST', '**/api/chat/openai', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          id: 'chatcmpl-test',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          choices: [{
            message: {
              role: 'assistant',
              content: `OpenAI response to: "${req.body.messages[req.body.messages.length - 1].content}"`
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 30,
            total_tokens: 50
          }
        }
      })
    }).as('openaiRequest')
    
    cy.intercept('POST', '**/api/chat/anthropic', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          id: 'msg-test',
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229',
          content: [{
            type: 'text',
            text: `Claude response to: "${req.body.messages[req.body.messages.length - 1].content}"`
          }],
          usage: {
            input_tokens: 15,
            output_tokens: 25
          }
        }
      })
    }).as('anthropicRequest')
    
    cy.intercept('POST', '**/api/chat/google', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          candidates: [{
            content: {
              parts: [{
                text: `Gemini response to: "${req.body.contents[req.body.contents.length - 1].parts[0].text}"`
              }]
            },
            finishReason: 'STOP'
          }],
          provider: 'google',
          model: 'gemini-pro',
          usageMetadata: {
            promptTokenCount: 18,
            candidatesTokenCount: 22,
            totalTokenCount: 40
          }
        }
      })
    }).as('googleRequest')
    
    // Mock provider switching endpoint
    cy.intercept('POST', '**/api/multillm/switch-provider', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          provider: req.body.provider,
          model: getDefaultModel(req.body.provider),
          status: 'ready'
        }
      })
    }).as('switchProvider')
    
    // Mock chat history endpoint
    cy.intercept('GET', '**/api/chat/history', {
      statusCode: 200,
      body: {
        messages: TestDataSets.sampleChatMessages
      }
    }).as('chatHistory')
    
    // Mock export endpoint
    cy.intercept('POST', '**/api/chat/export', {
      statusCode: 200,
      body: {
        url: '/downloads/chat-export.json',
        filename: 'chat-history.json'
      }
    }).as('exportChat')
  })

  it('should load chat interface with default provider', () => {
    chatPage.visit()
    
    // Wait for initial data
    cy.wait('@chatHistory')
    
    // Verify chat interface elements
    chatPage.getByTestId('llm-provider-selector').should('be.visible')
    chatPage.getByTestId('chat-input').should('be.visible')
    chatPage.getByTestId('send-message-button').should('be.visible')
    chatPage.getByTestId('chat-messages').should('be.visible')
    
    // Verify default provider is selected (OpenAI)
    chatPage.getByTestId('llm-provider-selector').should('contain', 'OpenAI')
    
    // Verify model settings panel
    chatPage.getByTestId('model-settings').should('be.visible')
    chatPage.getByTestId('temperature-slider').should('be.visible')
    chatPage.getByTestId('max-tokens-input').should('be.visible')
  })

  it('should send message to OpenAI provider', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    const testMessage = 'Analyze my e-commerce sales data for trends'
    
    // Send message
    chatPage.sendMessage(testMessage)
    
    // Wait for API response
    cy.wait('@openaiRequest')
    
    // Verify message appears in chat
    chatPage.expectMessage(testMessage)
    chatPage.expectMessage('OpenAI response to: "Analyze my e-commerce sales data for trends"')
    
    // Verify token usage is displayed
    cy.contains('Tokens used: 50').should('be.visible')
  })

  it('should switch between LLM providers', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Switch to Anthropic
    chatPage.selectProvider('anthropic')
    cy.wait('@switchProvider')
    chatPage.expectProviderSwitched('anthropic')
    
    // Send message to Anthropic
    const anthropicMessage = 'Help me optimize my product descriptions'
    chatPage.sendMessage(anthropicMessage)
    cy.wait('@anthropicRequest')
    chatPage.expectMessage('Claude response to: "Help me optimize my product descriptions"')
    
    // Switch to Google
    chatPage.selectProvider('google')
    cy.wait('@switchProvider')
    chatPage.expectProviderSwitched('google')
    
    // Send message to Google
    const googleMessage = 'Create marketing strategies for my products'
    chatPage.sendMessage(googleMessage)
    cy.wait('@googleRequest')
    chatPage.expectMessage('Gemini response to: "Create marketing strategies for my products"')
  })

  it('should handle provider API errors gracefully', () => {
    // Mock API error for OpenAI
    cy.intercept('POST', '**/api/chat/openai', {
      statusCode: 500,
      body: {
        error: 'api_error',
        message: 'OpenAI API is temporarily unavailable'
      }
    }).as('openaiError')
    
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send message
    chatPage.sendMessage('Test message')
    
    // Wait for error response
    cy.wait('@openaiError')
    
    // Should show error message
    chatPage.expectErrorMessage('OpenAI API is temporarily unavailable')
    
    // Should suggest trying another provider
    cy.contains('Try switching to another provider').should('be.visible')
    
    // Switch to working provider
    chatPage.selectProvider('anthropic')
    cy.wait('@switchProvider')
    
    // Retry the message
    chatPage.sendMessage('Test message')
    cy.wait('@anthropicRequest')
    chatPage.expectMessage('Claude response to: "Test message"')
  })

  it('should adjust model parameters', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Adjust temperature
    chatPage.setTemperature(0.8)
    
    // Adjust max tokens
    chatPage.setMaxTokens(2000)
    
    // Set system prompt
    chatPage.setSystemPrompt('You are a helpful e-commerce analytics assistant.')
    
    // Send message
    chatPage.sendMessage('Analyze my data')
    
    // Verify parameters are sent in API request
    cy.wait('@openaiRequest').then((interception) => {
      expect(interception.request.body.temperature).to.equal(0.8)
      expect(interception.request.body.max_tokens).to.equal(2000)
      expect(interception.request.body.messages[0].content).to.contain('helpful e-commerce analytics assistant')
    })
  })

  it('should clear chat history', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send a few messages
    chatPage.sendMessage('First message')
    cy.wait('@openaiRequest')
    
    chatPage.sendMessage('Second message')
    cy.wait('@openaiRequest')
    
    // Verify messages exist
    chatPage.expectMessage('First message')
    chatPage.expectMessage('Second message')
    
    // Clear chat
    chatPage.clearChat()
    
    // Verify chat is cleared
    chatPage.getByTestId('chat-messages').should('not.contain', 'First message')
    chatPage.getByTestId('chat-messages').should('not.contain', 'Second message')
  })

  it('should export chat history', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send some messages
    chatPage.sendMessage('Export test message 1')
    cy.wait('@openaiRequest')
    
    chatPage.sendMessage('Export test message 2')
    cy.wait('@openaiRequest')
    
    // Export chat
    chatPage.exportChat()
    
    // Wait for export request
    cy.wait('@exportChat')
    
    // Verify download initiated
    cy.contains('Chat exported successfully').should('be.visible')
  })

  it('should handle rate limiting', () => {
    // Mock rate limit error
    cy.intercept('POST', '**/api/chat/openai', {
      statusCode: 429,
      body: {
        error: 'rate_limit_exceeded',
        message: 'Rate limit exceeded. Please try again in 60 seconds.',
        retry_after: 60
      }
    }).as('rateLimitError')
    
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send message
    chatPage.sendMessage('Rate limit test')
    
    // Wait for rate limit error
    cy.wait('@rateLimitError')
    
    // Should show rate limit message
    chatPage.expectErrorMessage('Rate limit exceeded. Please try again in 60 seconds.')
    
    // Should show retry timer
    cy.contains('Retry in 60 seconds').should('be.visible')
  })

  it('should preserve conversation context across provider switches', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Start conversation with OpenAI
    chatPage.sendMessage('My store sells electronics')
    cy.wait('@openaiRequest')
    
    // Switch to Anthropic
    chatPage.selectProvider('anthropic')
    cy.wait('@switchProvider')
    
    // Continue conversation
    chatPage.sendMessage('What marketing strategies would you recommend?')
    
    // Verify context is maintained in API request
    cy.wait('@anthropicRequest').then((interception) => {
      const messages = interception.request.body.messages
      expect(messages).to.have.length.greaterThan(1)
      expect(messages[0].content).to.contain('My store sells electronics')
    })
  })

  it('should handle streaming responses', () => {
    // Mock streaming response
    cy.intercept('POST', '**/api/chat/openai', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          stream: true,
          chunks: [
            { delta: { content: 'This is ' } },
            { delta: { content: 'a streaming ' } },
            { delta: { content: 'response.' } }
          ]
        }
      })
    }).as('streamingRequest')
    
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send message
    chatPage.sendMessage('Test streaming')
    
    // Wait for streaming response
    cy.wait('@streamingRequest')
    
    // Verify streaming indicator
    cy.contains('AI is typing...').should('be.visible')
    
    // Verify final message
    chatPage.expectMessage('This is a streaming response.')
  })

  it('should show typing indicators and response times', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send message
    chatPage.sendMessage('Performance test message')
    
    // Should show typing indicator
    cy.contains('OpenAI is typing...').should('be.visible')
    
    // Wait for response
    cy.wait('@openaiRequest')
    
    // Typing indicator should disappear
    cy.contains('OpenAI is typing...').should('not.exist')
    
    // Should show response time
    cy.contains('Response time:').should('be.visible')
  })

  it('should handle model-specific features', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Test with different providers to verify model-specific options
    
    // OpenAI - should show function calling option
    chatPage.getByTestId('function-calling-toggle').should('be.visible')
    
    // Switch to Anthropic
    chatPage.selectProvider('anthropic')
    cy.wait('@switchProvider')
    
    // Claude - should show different options
    chatPage.getByTestId('claude-specific-options').should('be.visible')
    
    // Switch to Google
    chatPage.selectProvider('google')
    cy.wait('@switchProvider')
    
    // Gemini - should show safety settings
    chatPage.getByTestId('safety-settings').should('be.visible')
  })

  it('should provide usage analytics', () => {
    chatPage.visit()
    cy.wait('@chatHistory')
    
    // Send multiple messages
    chatPage.sendMessage('Message 1')
    cy.wait('@openaiRequest')
    
    chatPage.sendMessage('Message 2')
    cy.wait('@openaiRequest')
    
    // Check usage analytics
    chatPage.getByTestId('usage-analytics').click()
    
    // Verify analytics data
    cy.contains('Total messages: 2').should('be.visible')
    cy.contains('Tokens used: 100').should('be.visible')
    cy.contains('Estimated cost:').should('be.visible')
  })
})

// Helper function to get default model for provider
function getDefaultModel(provider: string): string {
  const models = {
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-sonnet-20240229',
    google: 'gemini-pro'
  }
  return models[provider as keyof typeof models] || 'unknown'
}