module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  verbose: true,
  // Security test specific configuration
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};