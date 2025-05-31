import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { apiClient } from '../../api/apiClient';
import { createWrapper } from '../../tests/utils/testUtils';
import { mockAuthResponse, mockErrorResponse } from '../../tests/mocks/apiMocks';

// Mock the API client
vi.mock('../../api/apiClient', () => ({
  apiClient: {
    auth: {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn()
    }
  }
}));

// Mock storage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLocalStorage.clear();
    
    // Reset mocks
    vi.mocked(apiClient.auth.login).mockReset();
    vi.mocked(apiClient.auth.refresh).mockReset();
    vi.mocked(apiClient.auth.logout).mockReset();
  });

  it('should initialize with unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should login successfully', async () => {
    vi.mocked(apiClient.auth.login).mockResolvedValue(mockAuthResponse);
    
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    // Initial state
    expect(result.current.isAuthenticated).toBe(false);
    
    // Trigger login
    act(() => {
      result.current.login('test-shop.myshopify.com');
    });
    
    // Loading state
    expect(result.current.isLoading).toBe(true);
    
    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Final state
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).not.toBeNull();
    expect(result.current.error).toBeNull();
    
    // Check localStorage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'auth_token', 
      expect.stringContaining(mockAuthResponse.accessToken)
    );
    
    // API called correctly
    expect(apiClient.auth.login).toHaveBeenCalledWith('test-shop.myshopify.com');
  });

  it('should handle login failure', async () => {
    vi.mocked(apiClient.auth.login).mockRejectedValue(new Error('Auth failed'));
    
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    // Trigger login
    act(() => {
      result.current.login('test-shop.myshopify.com');
    });
    
    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Error state
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Authentication failed');
    
    // No token saved
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
      'auth_token', 
      expect.anything()
    );
  });

  it('should refresh token successfully', async () => {
    // Mock existing token in storage
    mockLocalStorage.setItem('auth_token', JSON.stringify({
      accessToken: 'old-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() - 1000).toISOString() // Expired token
    }));
    
    vi.mocked(apiClient.auth.refresh).mockResolvedValue({
      ...mockAuthResponse,
      accessToken: 'new-access-token'
    });
    
    // Initialize hook with existing token
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    // Hook should attempt to refresh the token automatically
    await waitFor(() => {
      expect(apiClient.auth.refresh).toHaveBeenCalledWith('test-refresh-token');
    });
    
    // Should update the token in storage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'auth_token',
      expect.stringContaining('new-access-token')
    );
    
    // Should be authenticated
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should logout successfully', async () => {
    // Set initial authenticated state
    mockLocalStorage.setItem('auth_token', JSON.stringify({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }));
    
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    // Should initialize as authenticated
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    
    // Trigger logout
    act(() => {
      result.current.logout();
    });
    
    // Should be logged out
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    
    // Token should be removed from storage
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    
    // API logout should be called
    expect(apiClient.auth.logout).toHaveBeenCalled();
  });

  it('should handle expired tokens and failed refresh', async () => {
    // Set expired token
    mockLocalStorage.setItem('auth_token', JSON.stringify({
      accessToken: 'expired-access-token',
      refreshToken: 'invalid-refresh-token',
      expiresAt: new Date(Date.now() - 1000).toISOString()
    }));
    
    // Refresh will fail
    vi.mocked(apiClient.auth.refresh).mockRejectedValue(new Error('Refresh failed'));
    
    // Initialize hook with expired token
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    
    // Should attempt to refresh
    await waitFor(() => {
      expect(apiClient.auth.refresh).toHaveBeenCalledWith('invalid-refresh-token');
    });
    
    // Should fail to authenticate
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Session expired. Please login again.');
    
    // Token should be removed from storage
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });
});