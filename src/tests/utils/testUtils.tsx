import React, { ReactNode } from 'react';
// Note: Redux and React Query imports removed for now due to missing dependencies
// import { configureStore, PreloadedState } from '@reduxjs/toolkit';
// import { Provider } from 'react-redux';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ThemeProvider } from '@shopify/polaris';
// import { AppProvider } from '@shopify/app-bridge-react';
// import { rootReducer, RootState } from '../../store';

/**
 * Create a testing wrapper - simplified version
 * TODO: Add React Query and Redux providers when dependencies are available
 */
export function createWrapper() {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div data-testid="test-wrapper">
      {children}
    </div>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

/**
 * A utility function to create a test store - simplified version
 * TODO: Add Redux store configuration when dependencies are available
 */
export function createTestStore(preloadedState?: Record<string, unknown>) {
  // Mock store for now
  const mockStore = {
    getState: () => preloadedState || {},
    dispatch: () => {},
    subscribe: () => {}
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div data-testid="test-store-wrapper">
      {children}
    </div>
  );

  return { store: mockStore, Wrapper };
}

/**
 * Creates mock response objects for testing API functions
 */
export const createMockResponse = <T,>(data: T, status = 200, statusText = 'OK') => {
  return {
    data,
    status,
    statusText,
    headers: {},
    config: {},
    request: {}
  };
};

/**
 * Wait for a specified amount of time (in ms)
 * Useful for testing async operations
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock the localStorage API for testing
 */
export const mockLocalStorage = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    getStore: () => store
  };
};

/**
 * Helper to simulate a failed API response for testing error handling
 */
export const createErrorResponse = (status = 500, message = 'Internal Server Error') => {
  const error = new Error(message) as Error & {
    response?: {
      status: number;
      data: { message: string };
    };
  };
  error.response = {
    status,
    data: { message }
  };
  return error;
};