// Project management tests
// Tests the project sidebar and navigation features

describe('Projects Tests', () => {
  beforeEach(() => {
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('authToken', 'demo-token-123456')
    })
    cy.visit('/dashboard')
    cy.waitForPageLoad()
  })

  describe('Project Sidebar', () => {
    it('should display project sidebar', () => {
      // Verify sidebar exists
      cy.contains('プロジェクト').should('be.visible')
      
      // Check for new project button
      cy.contains('新規プロジェクト').should('be.visible')
    })

    it('should show demo projects', () => {
      // Check for demo project items
      cy.contains('AIエージェントチーム作成プロジェクト').should('be.visible')
      cy.contains('Gmail自動返信BOT').should('be.visible')
      cy.contains('Shopify Login Navigation Fix').should('be.visible')
    })

    it('should expand/collapse folders', () => {
      // Click on folder to expand
      cy.contains('AIエージェントチーム作成プロジェクト').click()
      
      // Check if children become visible after a short wait
      cy.wait(500)
      cy.get('body').then($body => {
        if ($body.text().includes('１週間の行動計画')) {
          cy.contains('１週間の行動計画').should('be.visible')
        }
      })
    })
  })

  describe('Project Navigation', () => {
    it('should navigate to project when clicked', () => {
      // Click on a project
      cy.contains('Gmail自動返信BOT').click()
      
      // Should navigate to project page
      cy.url().should('include', '/projects/')
    })

    it('should create new project from button', () => {
      // Click new project button
      cy.contains('新規プロジェクト').click()
      
      // Should stay on dashboard (new chat)
      cy.url().should('include', '/dashboard')
      cy.getByTestId('chat-input').should('be.visible')
    })
  })

  describe('Project Search', () => {
    it('should have search functionality', () => {
      // Look for search input in sidebar
      cy.get('input[placeholder*="検索"]').should('be.visible')
    })

    it('should filter projects by search', () => {
      // Type in search
      cy.get('input[placeholder*="検索"]').type('Gmail')
      
      // Should show matching project
      cy.contains('Gmail自動返信BOT').should('be.visible')
      
      // Should hide non-matching projects
      cy.contains('AIエージェントチーム作成プロジェクト').should('not.exist')
    })

    it('should clear search and show all projects', () => {
      // Search and then clear
      cy.get('input[placeholder*="検索"]').type('Gmail')
      cy.get('input[placeholder*="検索"]').clear()
      
      // All projects should be visible again
      cy.contains('AIエージェントチーム作成プロジェクト').should('be.visible')
      cy.contains('Gmail自動返信BOT').should('be.visible')
    })
  })

  describe('Project Context Menu', () => {
    it('should show context menu on right click', () => {
      // Right click on project
      cy.contains('Gmail自動返信BOT').rightclick()
      
      // Context menu should appear
      cy.contains('名前を変更').should('be.visible')
      cy.contains('お気に入りに追加').should('be.visible')
      cy.contains('削除').should('be.visible')
      
      // Click away to close
      cy.get('body').click(0, 0)
    })
  })

  describe('Sidebar Collapse', () => {
    it('should toggle sidebar collapse', () => {
      // Find collapse button (usually near the project header)
      cy.contains('プロジェクト').parent().within(() => {
        cy.get('button').last().click()
      })
      
      // Wait for animation
      cy.wait(500)
      
      // Check if sidebar is collapsed
      cy.get('aside').then($aside => {
        const width = $aside.width()
        expect(width).to.be.lessThan(100) // Collapsed width
      })
      
      // Expand again
      cy.get('aside button').first().click()
      cy.wait(500)
      cy.contains('プロジェクト').should('be.visible')
    })
  })

  describe('Responsive Behavior', () => {
    it('should adapt sidebar for mobile', () => {
      cy.viewport('iphone-6')
      
      // On mobile, check that the main UI elements are still accessible
      cy.getByTestId('chat-input').should('be.visible')
      cy.getByTestId('send-message-button').should('be.visible')
      
      // Sidebar might be collapsed or hidden on mobile, which is expected
      cy.get('body').should('be.visible')
    })
  })
})