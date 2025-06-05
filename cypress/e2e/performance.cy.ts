// Performance tests for Conea AI Platform
// Ensures optimal user experience and system efficiency

describe('Performance Tests', () => {
  let performanceMetrics: any = {}

  beforeEach(() => {
    // Reset performance metrics
    performanceMetrics = {}
    
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }))
    })

    // Start performance monitoring
    cy.window().then((win) => {
      // Mark the start of performance measurement
      win.performance.mark('test-start')
    })
  })

  afterEach(() => {
    // Collect performance metrics
    cy.window().then((win) => {
      win.performance.mark('test-end')
      win.performance.measure('test-duration', 'test-start', 'test-end')
      
      const measurements = win.performance.getEntriesByType('measure')
      const lastMeasurement = measurements[measurements.length - 1]
      
      cy.log(`Test Duration: ${lastMeasurement.duration}ms`)
      
      // Log performance metrics
      if (performanceMetrics.pageLoad) {
        cy.log(`Page Load Time: ${performanceMetrics.pageLoad}ms`)
      }
      if (performanceMetrics.apiResponse) {
        cy.log(`API Response Time: ${performanceMetrics.apiResponse}ms`)
      }
    })
  })

  describe('Page Load Performance', () => {
    it('should load dashboard within performance budget', () => {
      const startTime = Date.now()
      
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Wait for main content to be visible
      cy.getByTestId('dashboard-content').should('be.visible')
      
      const endTime = Date.now()
      const loadTime = endTime - startTime
      performanceMetrics.pageLoad = loadTime
      
      // Performance budget: 3 seconds
      expect(loadTime).to.be.lessThan(3000)
    })

    it('should load login page quickly', () => {
      const startTime = Date.now()
      
      cy.visit('/login')
      cy.waitForPageLoad()
      
      // Check critical rendering path
      cy.getByTestId('email-input').should('be.visible')
      cy.getByTestId('password-input').should('be.visible')
      cy.getByTestId('login-button').should('be.visible')
      
      const endTime = Date.now()
      const loadTime = endTime - startTime
      performanceMetrics.pageLoad = loadTime
      
      // Performance budget: 2 seconds for login
      expect(loadTime).to.be.lessThan(2000)
    })

    it('should have acceptable First Contentful Paint', () => {
      cy.visit('/dashboard')
      
      cy.window().then((win) => {
        // Wait for performance entries to be available
        cy.wait(1000)
        
        const perfEntries = win.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        if (perfEntries.length > 0) {
          const navTiming = perfEntries[0]
          const fcp = navTiming.loadEventStart - navTiming.fetchStart
          
          cy.log(`First Contentful Paint: ${fcp}ms`)
          
          // FCP should be under 1.8 seconds (good performance)
          expect(fcp).to.be.lessThan(1800)
        }
      })
    })
  })

  describe('API Response Performance', () => {
    it('should have fast API responses', () => {
      cy.intercept('GET', '**/api/dashboard/summary', (req) => {
        const startTime = Date.now()
        
        req.reply((res) => {
          const endTime = Date.now()
          const responseTime = endTime - startTime
          performanceMetrics.apiResponse = responseTime
          
          res.send({
            statusCode: 200,
            body: {
              totalOrders: 120,
              totalSales: '$9,876.54',
              responseTime: responseTime
            }
          })
        })
      }).as('dashboardAPI')
      
      cy.visit('/dashboard')
      cy.wait('@dashboardAPI')
      
      // API response should be under 2 seconds
      expect(performanceMetrics.apiResponse).to.be.lessThan(2000)
    })

    it('should handle concurrent API requests efficiently', () => {
      // Mock multiple simultaneous API calls
      cy.intercept('GET', '**/api/projects', { fixture: 'projects.json' }).as('projectsAPI')
      cy.intercept('GET', '**/api/dashboard/summary', { fixture: 'dashboard.json' }).as('dashboardAPI')
      cy.intercept('GET', '**/api/settings/api-keys', { fixture: 'api-keys.json' }).as('apiKeysAPI')
      
      const startTime = Date.now()
      
      cy.visit('/dashboard')
      
      // Wait for all API calls to complete
      cy.wait(['@dashboardAPI'])
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Multiple API calls should complete within reasonable time
      expect(totalTime).to.be.lessThan(5000)
    })
  })

  describe('Memory Usage', () => {
    it('should not have memory leaks during navigation', () => {
      let initialMemory: number
      let finalMemory: number
      
      cy.window().then((win) => {
        // Get initial memory usage (if available)
        if ('memory' in win.performance) {
          initialMemory = (win.performance as any).memory.usedJSHeapSize
        }
      })
      
      // Navigate through multiple pages
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      cy.visit('/api-settings')
      cy.waitForPageLoad()
      
      cy.visit('/multillm-chat')
      cy.waitForPageLoad()
      
      // Force garbage collection if possible
      cy.window().then((win) => {
        if ((win as any).gc) {
          (win as any).gc()
        }
      })
      
      cy.window().then((win) => {
        if ('memory' in win.performance) {
          finalMemory = (win.performance as any).memory.usedJSHeapSize
          const memoryIncrease = finalMemory - initialMemory
          
          cy.log(`Memory increase: ${memoryIncrease} bytes`)
          
          // Memory increase should be reasonable (less than 50MB)
          expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024)
        }
      })
    })

    it('should clean up event listeners on page unload', () => {
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      cy.window().then((win) => {
        // Count initial event listeners
        const initialListeners = Object.keys(win as any).filter(key => 
          key.startsWith('on') || key.includes('listener')
        ).length
        
        // Navigate away and back
        cy.visit('/projects')
        cy.waitForPageLoad()
        
        cy.visit('/dashboard')
        cy.waitForPageLoad()
        
        // Count final event listeners
        const finalListeners = Object.keys(win as any).filter(key => 
          key.startsWith('on') || key.includes('listener')
        ).length
        
        // Should not accumulate many new listeners
        expect(finalListeners - initialListeners).to.be.lessThan(10)
      })
    })
  })

  describe('Resource Loading', () => {
    it('should load critical resources first', () => {
      cy.visit('/dashboard')
      
      cy.window().then((win) => {
        // Check resource loading order
        const resources = win.performance.getEntriesByType('resource') as PerformanceResourceTiming[]
        const criticalResources = resources.filter(resource => 
          resource.name.includes('.css') || 
          resource.name.includes('main.js') ||
          resource.name.includes('vendor.js')
        )
        
        criticalResources.forEach(resource => {
          // Critical resources should load quickly
          expect(resource.responseEnd - resource.fetchStart).to.be.lessThan(1000)
        })
      })
    })

    it('should optimize image loading', () => {
      cy.visit('/')
      cy.waitForPageLoad()
      
      cy.get('img').each(($img) => {
        cy.wrap($img).should('be.visible')
        
        // Check for lazy loading attribute
        cy.wrap($img).should(($el) => {
          const loading = $el.attr('loading')
          const isAboveFold = $el.offset()!.top < 600
          
          if (!isAboveFold) {
            expect(loading).to.equal('lazy')
          }
        })
      })
    })
  })

  describe('JavaScript Performance', () => {
    it('should have efficient DOM manipulation', () => {
      cy.visit('/projects')
      cy.waitForPageLoad()
      
      // Measure time for DOM-heavy operation
      const startTime = Date.now()
      
      // Trigger operation that updates many DOM elements
      cy.getByTestId('create-project-button').click()
      cy.getByTestId('project-modal').should('be.visible')
      
      const endTime = Date.now()
      const operationTime = endTime - startTime
      
      // DOM operation should be under 500ms
      expect(operationTime).to.be.lessThan(500)
    })

    it('should have responsive user interactions', () => {
      cy.visit('/multillm-chat')
      cy.waitForPageLoad()
      
      // Mock chat API with realistic delay
      cy.intercept('POST', '**/api/chat/openai', (req) => {
        req.reply((res) => {
          res.delay(100) // Simulate network delay
          res.send({
            statusCode: 200,
            body: { message: 'Response', tokens: 50 }
          })
        })
      }).as('chatAPI')
      
      const startTime = Date.now()
      
      // Test user interaction responsiveness
      cy.getByTestId('chat-input').type('Test message')
      cy.getByTestId('send-message-button').click()
      
      // UI should respond immediately, even if API is pending
      cy.getByTestId('chat-messages').should('contain', 'Test message')
      
      const uiResponseTime = Date.now() - startTime
      
      // UI should respond within 100ms
      expect(uiResponseTime).to.be.lessThan(100)
      
      cy.wait('@chatAPI')
    })
  })

  describe('Network Performance', () => {
    it('should handle slow network conditions', () => {
      // Simulate slow 3G connection
      cy.intercept('GET', '**/api/**', (req) => {
        req.reply((res) => {
          res.delay(2000) // 2 second delay
          res.send({ statusCode: 200, body: { message: 'Slow response' } })
        })
      }).as('slowAPI')
      
      cy.visit('/dashboard')
      
      // Should show loading state immediately
      cy.getByTestId('loading-spinner').should('be.visible')
      
      // Should eventually load even with slow network
      cy.wait('@slowAPI')
      cy.getByTestId('dashboard-content').should('be.visible')
    })

    it('should batch API requests efficiently', () => {
      let requestCount = 0
      
      cy.intercept('GET', '**/api/**', (req) => {
        requestCount++
        req.reply({ statusCode: 200, body: { data: 'test' } })
      }).as('apiRequests')
      
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      // Should not make excessive API requests
      expect(requestCount).to.be.lessThan(10)
    })
  })

  describe('Rendering Performance', () => {
    it('should render large lists efficiently', () => {
      // Mock large dataset
      const largeProjectList = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Project ${i}`,
        description: `Description for project ${i}`
      }))
      
      cy.intercept('GET', '**/api/projects', {
        statusCode: 200,
        body: { projects: largeProjectList }
      }).as('largeProjectsAPI')
      
      const startTime = Date.now()
      
      cy.visit('/projects')
      cy.wait('@largeProjectsAPI')
      
      // Should render efficiently even with large lists
      cy.getByTestId('project-list').should('be.visible')
      
      const renderTime = Date.now() - startTime
      
      // Should render within 2 seconds even with 1000 items
      expect(renderTime).to.be.lessThan(2000)
    })

    it('should handle rapid state changes smoothly', () => {
      cy.visit('/multillm-chat')
      cy.waitForPageLoad()
      
      // Rapidly switch between providers
      const startTime = Date.now()
      
      cy.switchLLMProvider('anthropic')
      cy.switchLLMProvider('google')
      cy.switchLLMProvider('openai')
      cy.switchLLMProvider('anthropic')
      
      const switchTime = Date.now() - startTime
      
      // Rapid state changes should be smooth
      expect(switchTime).to.be.lessThan(1000)
      
      // Final state should be stable
      cy.getByTestId('llm-provider-selector').should('contain', 'Anthropic')
    })
  })

  describe('Accessibility Performance', () => {
    it('should maintain performance with screen reader support', () => {
      // Enable ARIA live regions and screen reader support
      cy.visit('/dashboard')
      cy.waitForPageLoad()
      
      const startTime = Date.now()
      
      // Trigger updates that should announce to screen readers
      cy.getByTestId('refresh-dashboard-btn').click()
      
      // Should update ARIA live regions without performance impact
      cy.get('[aria-live="polite"]').should('contain.text', 'Loading')
      
      const updateTime = Date.now() - startTime
      
      // ARIA updates should be fast
      expect(updateTime).to.be.lessThan(200)
    })
  })
})