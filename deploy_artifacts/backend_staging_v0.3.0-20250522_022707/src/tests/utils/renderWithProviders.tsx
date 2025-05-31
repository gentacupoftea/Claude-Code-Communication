import React, { PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@shopify/polaris';
import { AppProvider } from '@shopify/app-bridge-react';
import { BrowserRouter } from 'react-router-dom';

import { rootReducer, RootState } from '../../store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof configureStore>;
  route?: string;
  routes?: { path: string; element: React.ReactNode }[];
}

/**
 * Test utility to render components with Redux, Router, and other providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: rootReducer,
      preloadedState
    }),
    route = '/',
    routes = [],
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  // Create a new QueryClient for each test
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

  function Wrapper({ children }: PropsWithChildren<{}>): JSX.Element {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AppProvider {...mockConfig}>
              <MemoryRouter initialEntries={[route]}>
                {routes.length > 0 ? (
                  <Routes>
                    {routes.map(({ path, element }) => (
                      <Route key={path} path={path} element={element} />
                    ))}
                    <Route path="*" element={children} />
                  </Routes>
                ) : (
                  children
                )}
              </MemoryRouter>
            </AppProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    );
  }

  return { 
    store, 
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }) 
  };
}

/**
 * Utility for components that specifically need BrowserRouter instead of MemoryRouter
 */
export function renderWithBrowserRouter(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: rootReducer,
      preloadedState
    }),
    ...renderOptions
  }: Omit<ExtendedRenderOptions, 'route' | 'routes'> = {}
) {
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

  function Wrapper({ children }: PropsWithChildren<{}>): JSX.Element {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AppProvider {...mockConfig}>
              <BrowserRouter>
                {children}
              </BrowserRouter>
            </AppProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    );
  }

  return { 
    store, 
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }) 
  };
}