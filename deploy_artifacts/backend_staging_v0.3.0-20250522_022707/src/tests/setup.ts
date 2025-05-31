import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Set up MSW server
export const server = setupServer(...handlers);

// Establish API mocking before tests
beforeAll(() => {
  // Set up environment variables needed for tests
  process.env.VITE_SHOPIFY_API_KEY = 'test-api-key';
  process.env.VITE_SHOPIFY_API_VERSION = '2023-10';
  process.env.VITE_API_BASE_URL = 'https://api.test.com';
  
  server.listen({ onUnhandledRequest: 'error' });
  console.log('🔶 MSW server started');
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
  console.log('🔶 MSW server stopped');
});