import { ProjectsPage } from '../support/page-objects'
import { TestDataFactory, TestDataSets } from '../support/test-data'

describe('Projects Management', () => {
  let projectsPage: ProjectsPage

  beforeEach(() => {
    projectsPage = new ProjectsPage()
    
    // Set up authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', JSON.stringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }))
    })
    
    // Mock projects API endpoints
    cy.intercept('GET', '**/api/projects', {
      statusCode: 200,
      body: {
        projects: TestDataSets.sampleProjects,
        total: TestDataSets.sampleProjects.length,
        page: 1,
        pageSize: 10
      }
    }).as('getProjects')
    
    cy.intercept('POST', '**/api/projects', (req) => {
      const newProject = {
        id: `project-${Date.now()}`,
        ...req.body,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      req.reply({
        statusCode: 201,
        body: newProject
      })
    }).as('createProject')
    
    cy.intercept('PUT', '**/api/projects/*', (req) => {
      const updatedProject = {
        ...req.body,
        updatedAt: new Date().toISOString()
      }
      req.reply({
        statusCode: 200,
        body: updatedProject
      })
    }).as('updateProject')
    
    cy.intercept('DELETE', '**/api/projects/*', {
      statusCode: 204
    }).as('deleteProject')
    
    // Mock search endpoint
    cy.intercept('GET', '**/api/projects/search*', (req) => {
      const query = new URL(req.url).searchParams.get('q')
      const filteredProjects = TestDataSets.sampleProjects.filter(project =>
        project.name.toLowerCase().includes(query?.toLowerCase() || '') ||
        project.description.toLowerCase().includes(query?.toLowerCase() || '')
      )
      req.reply({
        statusCode: 200,
        body: {
          projects: filteredProjects,
          total: filteredProjects.length,
          query
        }
      })
    }).as('searchProjects')
  })

  it('should load projects list with correct data', () => {
    projectsPage.visit()
    
    // Wait for projects to load
    cy.wait('@getProjects')
    
    // Verify page elements
    projectsPage.getByTestId('create-project-button').should('be.visible')
    projectsPage.getByTestId('project-list').should('be.visible')
    projectsPage.getByTestId('project-search-input').should('be.visible')
    projectsPage.getByTestId('project-filter-dropdown').should('be.visible')
    
    // Verify sample projects are displayed
    TestDataSets.sampleProjects.forEach(project => {
      projectsPage.expectProjectExists(project.name)
    })
    
    // Verify project cards show correct information
    cy.get('[data-testid="project-item"]').first().within(() => {
      cy.get('[data-testid="project-name"]').should('contain', TestDataSets.sampleProjects[0].name)
      cy.get('[data-testid="project-description"]').should('contain', TestDataSets.sampleProjects[0].description)
      cy.get('[data-testid="project-status"]').should('contain', TestDataSets.sampleProjects[0].status)
    })
  })

  it('should create a new project successfully', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    const newProject = TestDataFactory.createTestProject({
      name: 'New Test Project',
      description: 'This is a newly created test project'
    })
    
    // Create project
    projectsPage.createProject(newProject.name, newProject.description)
    
    // Wait for creation request
    cy.wait('@createProject').then((interception) => {
      expect(interception.request.body.name).to.equal(newProject.name)
      expect(interception.request.body.description).to.equal(newProject.description)
    })
    
    // Should show success message
    projectsPage.expectSuccessMessage('Project created successfully')
    
    // Should close the create modal
    projectsPage.getByTestId('project-name-input').should('not.exist')
    
    // Project should appear in the list
    projectsPage.expectProjectExists(newProject.name)
  })

  it('should validate project creation form', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Try to create project without name
    projectsPage.clickByTestId('create-project-button')
    projectsPage.typeByTestId('project-description', 'Description without name')
    projectsPage.clickByTestId('save-project-button')
    
    // Should show validation error
    projectsPage.expectErrorMessage('Project name is required')
    
    // Try with very long name
    const longName = 'A'.repeat(101) // Assuming 100 char limit
    projectsPage.typeByTestId('project-name', longName)
    projectsPage.clickByTestId('save-project-button')
    
    // Should show length validation error
    projectsPage.expectErrorMessage('Project name must be 100 characters or less')
    
    // Try with duplicate name
    projectsPage.getByTestId('project-name-input').clear().type(TestDataSets.sampleProjects[0].name)
    projectsPage.clickByTestId('save-project-button')
    
    // Mock duplicate name error
    cy.intercept('POST', '**/api/projects', {
      statusCode: 409,
      body: {
        error: 'duplicate_name',
        message: 'A project with this name already exists'
      }
    }).as('duplicateProject')
    
    cy.wait('@duplicateProject')
    projectsPage.expectErrorMessage('A project with this name already exists')
  })

  it('should edit an existing project', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    const projectToEdit = TestDataSets.sampleProjects[0]
    const updatedName = 'Updated Project Name'
    const updatedDescription = 'Updated project description'
    
    // Edit the first project
    projectsPage.editProject(projectToEdit.id, updatedName, updatedDescription)
    
    // Wait for update request
    cy.wait('@updateProject').then((interception) => {
      expect(interception.request.body.name).to.equal(updatedName)
      expect(interception.request.body.description).to.equal(updatedDescription)
    })
    
    // Should show success message
    projectsPage.expectSuccessMessage('Project updated successfully')
    
    // Should reflect changes in the UI
    projectsPage.expectProjectExists(updatedName)
    projectsPage.expectProjectNotExists(projectToEdit.name)
  })

  it('should delete a project with confirmation', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    const projectToDelete = TestDataSets.sampleProjects[0]
    
    // Delete project
    projectsPage.deleteProject(projectToDelete.id)
    
    // Wait for deletion request
    cy.wait('@deleteProject')
    
    // Should show success message
    projectsPage.expectSuccessMessage('Project deleted successfully')
    
    // Project should be removed from the list
    projectsPage.expectProjectNotExists(projectToDelete.name)
  })

  it('should search projects by name and description', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    const searchQuery = 'analytics'
    
    // Perform search
    projectsPage.searchProjects(searchQuery)
    
    // Wait for search results
    cy.wait('@searchProjects')
    
    // Should show only matching projects
    projectsPage.expectProjectExists('E-commerce Analytics')
    projectsPage.expectProjectNotExists('Inventory Management')
    
    // Clear search
    projectsPage.getByTestId('project-search-input').clear()
    cy.wait('@getProjects')
    
    // Should show all projects again
    TestDataSets.sampleProjects.forEach(project => {
      projectsPage.expectProjectExists(project.name)
    })
  })

  it('should filter projects by status', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Mock filtered results for active projects
    cy.intercept('GET', '**/api/projects?status=active', {
      statusCode: 200,
      body: {
        projects: TestDataSets.sampleProjects.filter(p => p.status === 'active'),
        total: 2,
        filter: 'active'
      }
    }).as('getActiveProjects')
    
    // Filter by active status
    projectsPage.filterProjects('Active Only')
    
    // Wait for filtered results
    cy.wait('@getActiveProjects')
    
    // Should show only active projects
    projectsPage.expectProjectExists('E-commerce Analytics')
    projectsPage.expectProjectExists('Inventory Management')
    projectsPage.expectProjectNotExists('Customer Insights') // This one is inactive
    
    // Reset filter
    projectsPage.filterProjects('All Projects')
    cy.wait('@getProjects')
  })

  it('should sort projects by different criteria', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Mock sorted results
    cy.intercept('GET', '**/api/projects?sort=name&order=asc', {
      statusCode: 200,
      body: {
        projects: [...TestDataSets.sampleProjects].sort((a, b) => a.name.localeCompare(b.name)),
        total: TestDataSets.sampleProjects.length,
        sort: 'name',
        order: 'asc'
      }
    }).as('getSortedProjects')
    
    // Sort by name
    projectsPage.sortProjects('Name (A-Z)')
    
    // Wait for sorted results
    cy.wait('@getSortedProjects')
    
    // Verify sorting order
    cy.get('[data-testid="project-item"]').first()
      .find('[data-testid="project-name"]')
      .should('contain', 'Customer Insights') // Should be first alphabetically
  })

  it('should handle project creation errors', () => {
    // Mock server error
    cy.intercept('POST', '**/api/projects', {
      statusCode: 500,
      body: {
        error: 'server_error',
        message: 'Internal server error'
      }
    }).as('serverError')
    
    projectsPage.visit()
    cy.wait('@getProjects')
    
    const newProject = TestDataFactory.createTestProject()
    
    // Try to create project
    projectsPage.createProject(newProject.name, newProject.description)
    
    // Wait for error
    cy.wait('@serverError')
    
    // Should show error message
    projectsPage.expectErrorMessage('Internal server error')
    
    // Form should remain open for retry
    projectsPage.getByTestId('project-name-input').should('be.visible')
  })

  it('should handle network errors gracefully', () => {
    // Mock network error
    cy.intercept('GET', '**/api/projects', {
      forceNetworkError: true
    }).as('networkError')
    
    projectsPage.visit()
    
    // Wait for network error
    cy.wait('@networkError')
    
    // Should show error state
    projectsPage.expectErrorMessage('Unable to load projects. Please check your connection.')
    
    // Should show retry button
    projectsPage.getByTestId('retry-button').should('be.visible')
    
    // Mock successful retry
    cy.intercept('GET', '**/api/projects', {
      statusCode: 200,
      body: {
        projects: TestDataSets.sampleProjects,
        total: TestDataSets.sampleProjects.length
      }
    }).as('retrySuccess')
    
    // Click retry
    projectsPage.clickByTestId('retry-button')
    
    // Should load successfully
    cy.wait('@retrySuccess')
    projectsPage.expectProjectExists(TestDataSets.sampleProjects[0].name)
  })

  it('should show project statistics and metrics', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Verify project statistics
    cy.get('[data-testid="projects-stats"]').within(() => {
      cy.contains('Total Projects: 3').should('be.visible')
      cy.contains('Active: 2').should('be.visible')
      cy.contains('Inactive: 1').should('be.visible')
    })
    
    // Click on a project to view details
    cy.get('[data-testid="project-item"]').first().click()
    
    // Should show project details panel
    cy.get('[data-testid="project-details"]').should('be.visible')
    cy.get('[data-testid="project-metrics"]').should('be.visible')
  })

  it('should support bulk operations', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Select multiple projects
    cy.get('[data-testid="project-checkbox"]').first().check()
    cy.get('[data-testid="project-checkbox"]').eq(1).check()
    
    // Bulk actions should be available
    projectsPage.getByTestId('bulk-actions').should('be.visible')
    
    // Mock bulk delete
    cy.intercept('DELETE', '**/api/projects/bulk', {
      statusCode: 200,
      body: { deleted: 2 }
    }).as('bulkDelete')
    
    // Perform bulk delete
    projectsPage.getByTestId('bulk-delete-button').click()
    projectsPage.getByTestId('confirm-bulk-delete').click()
    
    // Wait for bulk operation
    cy.wait('@bulkDelete')
    
    // Should show success message
    projectsPage.expectSuccessMessage('2 projects deleted successfully')
  })

  it('should handle pagination correctly', () => {
    // Mock paginated response
    const manyProjects = TestDataFactory.createTestProjects(25)
    
    cy.intercept('GET', '**/api/projects?page=1&pageSize=10', {
      statusCode: 200,
      body: {
        projects: manyProjects.slice(0, 10),
        total: 25,
        page: 1,
        pageSize: 10,
        totalPages: 3
      }
    }).as('getFirstPage')
    
    cy.intercept('GET', '**/api/projects?page=2&pageSize=10', {
      statusCode: 200,
      body: {
        projects: manyProjects.slice(10, 20),
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3
      }
    }).as('getSecondPage')
    
    projectsPage.visit()
    cy.wait('@getFirstPage')
    
    // Should show pagination controls
    cy.get('[data-testid="pagination"]').should('be.visible')
    cy.contains('Page 1 of 3').should('be.visible')
    
    // Navigate to next page
    cy.get('[data-testid="next-page-button"]').click()
    cy.wait('@getSecondPage')
    
    // Should show page 2 content
    cy.contains('Page 2 of 3').should('be.visible')
  })

  it('should export projects data', () => {
    projectsPage.visit()
    cy.wait('@getProjects')
    
    // Mock export endpoint
    cy.intercept('POST', '**/api/projects/export', {
      statusCode: 200,
      body: {
        url: '/downloads/projects-export.csv',
        filename: 'projects.csv'
      }
    }).as('exportProjects')
    
    // Click export button
    projectsPage.getByTestId('export-projects-button').click()
    
    // Wait for export
    cy.wait('@exportProjects')
    
    // Should show export success message
    projectsPage.expectSuccessMessage('Projects exported successfully')
  })
})