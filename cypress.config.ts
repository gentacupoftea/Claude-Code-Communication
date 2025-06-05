import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:3000',
    
    // Viewport configuration
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Test file patterns
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Support file
    supportFile: 'cypress/support/e2e.ts',
    
    // Video recording
    video: true,
    videosFolder: 'cypress/videos',
    
    // Screenshots
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    
    // Test retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    
    // Test isolation
    testIsolation: true,
    
    // Environment variables
    env: {
      coverage: false,
      codeCoverage: {
        exclude: 'cypress/**/*.*'
      }
    },
    
    // Setup node events
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      
      // Browser launch configuration
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome') {
          launchOptions.args.push('--disable-dev-shm-usage')
          launchOptions.args.push('--no-sandbox')
          launchOptions.args.push('--disable-gpu')
        }
        
        if (browser.name === 'firefox') {
          launchOptions.args.push('--width=1280')
          launchOptions.args.push('--height=720')
        }
        
        return launchOptions
      })
      
      // Task registration
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        clearDatabase() {
          // Implementation for clearing test database
          return null
        }
      })
      
      return config
    },
    
    // Experimental features
    experimentalStudio: true,
    experimentalWebKitSupport: true
  },
  
  // Component testing configuration
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts'
  }
})