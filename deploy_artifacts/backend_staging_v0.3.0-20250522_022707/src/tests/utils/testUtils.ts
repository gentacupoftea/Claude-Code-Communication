import React, { ReactNode } from 'react';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@shopify/polaris';
import { AppProvider } from '@shopify/app-bridge-react';
import { rootReducer, RootState } from '../../store';

/**
 * Create a testing wrapper with React Query and Redux providers
 */
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  // Mock Shopify AppBridge config
  const mockConfig = {
    apiKey: 'test-api-key',
    host: 'test-host',
    forceRedirect: false
  };

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppProvider {...mockConfig}>
          {children}
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * A utility function to create a Redux store with the rootReducer and middleware
 * for testing purposes. Includes React Query client.
 */
export function createTestStore(preloadedState?: PreloadedState<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  const mockConfig = {
    apiKey: 'test-api-key',
    host: 'test-host',
    forceRedirect: false
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppProvider {...mockConfig}>
            {children}
          </AppProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );

  return { store, queryClient, Wrapper };
}

/**
 * Creates mock response objects for testing API functions
 */
export const createMockResponse = <T>(data: T, status = 200, statusText = 'OK') => {
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
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    getStore: () => store
  };
};

/**
 * Helper to simulate a failed API response for testing error handling
 */
export const createErrorResponse = (status = 500, message = 'Internal Server Error') => {
  const error = new Error(message) as any;
  error.response = {
    status,
    data: { message }
  };
  return error;
};