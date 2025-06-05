import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../apiClient';
import axios from 'axios';
import { mockAuthResponse, mockDashboardData } from '../../tests/mocks/apiMocks';

// Mock axios
vi.mock('axios');

describe('apiClient', () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup mock axios instance and response
    mockAxios.create.mockReturnValue(mockAxios as any);
    mockAxios.interceptors = {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    } as any;
  });
  
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('auth endpoints', () => {
    it('should handle login correctly', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: mockAuthResponse });
      
      const result = await apiClient.post('/auth/token', {
        shop: 'test-shop.myshopify.com'
      });
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/auth/token',
        expect.objectContaining({
          shop: 'test-shop.myshopify.com'
        }),
        expect.any(Object)
      );
      
      expect(result).toEqual(mockAuthResponse);
    });
    
    it('should handle token refresh correctly', async () => {
      const refreshedToken = { ...mockAuthResponse, accessToken: 'new-token' };
      mockAxios.post.mockResolvedValueOnce({ data: refreshedToken });
      
      const result = await apiClient.post('/auth/refresh', {
        refreshToken: 'old-refresh-token'
      });
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/auth/refresh',
        expect.objectContaining({
          refreshToken: 'old-refresh-token'
        }),
        expect.any(Object)
      );
      
      expect(result).toEqual(refreshedToken);
    });
    
    it('should handle logout correctly', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });
      
      const result = await apiClient.post('/auth/logout', {});
      
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/logout', {}, expect.any(Object));
      expect(result).toEqual({ success: true });
    });
  });

  describe('dashboard endpoints', () => {
    it('should fetch dashboard summary correctly', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: mockDashboardData });
      
      const result = await apiClient.get('/dashboard/summary');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/dashboard/summary', expect.any(Object));
      expect(result).toEqual(mockDashboardData);
    });
  });

  describe('products endpoints', () => {
    it('should fetch products correctly', async () => {
      const mockProducts = [{ id: '1', title: 'Test Product' }];
      mockAxios.get.mockResolvedValueOnce({ data: mockProducts });
      
      const result = await apiClient.get('/products');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/products', expect.any(Object));
      expect(result).toEqual(mockProducts);
    });
    
    it('should fetch a single product correctly', async () => {
      const mockProduct = { id: '1', title: 'Test Product' };
      mockAxios.get.mockResolvedValueOnce({ data: mockProduct });
      
      const result = await apiClient.get('/products/1');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/products/1', expect.any(Object));
      expect(result).toEqual(mockProduct);
    });
    
    it('should create a product correctly', async () => {
      const newProduct = { title: 'New Product', price: 19.99 };
      const createdProduct = { id: '2', ...newProduct };
      mockAxios.post.mockResolvedValueOnce({ data: createdProduct });
      
      const result = await apiClient.post('/products', newProduct);
      
      expect(mockAxios.post).toHaveBeenCalledWith('/products', newProduct, expect.any(Object));
      expect(result).toEqual(createdProduct);
    });
    
    it('should update a product correctly', async () => {
      const updatedData = { title: 'Updated Product' };
      const updatedProduct = { id: '1', title: 'Updated Product', price: 19.99 };
      mockAxios.put.mockResolvedValueOnce({ data: updatedProduct });
      
      const result = await apiClient.put('/products/1', updatedData);
      
      expect(mockAxios.put).toHaveBeenCalledWith('/products/1', updatedData, expect.any(Object));
      expect(result).toEqual(updatedProduct);
    });
    
    it('should delete a product correctly', async () => {
      mockAxios.delete.mockResolvedValueOnce({ data: { success: true } });
      
      const result = await apiClient.delete('/products/1');
      
      expect(mockAxios.delete).toHaveBeenCalledWith('/products/1', expect.any(Object));
    });
  });

  describe('axios interceptors', () => {
    it('should add authorization header when token exists', async () => {
      // Setup mock local storage with token
      const mockToken = {
        accessToken: 'test-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
      
      localStorage.setItem('auth_token', JSON.stringify(mockToken));
      
      // The interceptors are set up on initialization
      // We can directly use the mocked interceptors
      
      // Extract the interceptor function
      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      
      // Create a mock request config
      const mockConfig = { headers: {} };
      
      // Apply the interceptor
      const modifiedConfig = await requestInterceptor(mockConfig);
      
      // Verify authorization header was added
      expect(modifiedConfig.headers?.Authorization).toBe('Bearer test-token');
    });
    
    it('should handle request errors in interceptor', async () => {
      // The interceptors are set up on initialization
      // We can directly use the mocked interceptors
      
      // Extract the error handler from the interceptor
      const errorHandler = mockAxios.interceptors.request.use.mock.calls[0][1];
      
      // Create a mock error
      const mockError = new Error('Request failed');
      
      // Should rethrow the error
      await expect(errorHandler(mockError)).rejects.toThrow('Request failed');
    });
    
    it('should handle response errors in interceptor', async () => {
      // The interceptors are set up on initialization
      // We can directly use the mocked interceptors
      
      // Extract the error handler from the interceptor
      const errorHandler = mockAxios.interceptors.response.use.mock.calls[0][1];
      
      // Create a mock error with a 401 response
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      // Should rethrow the error for 401 responses
      await expect(errorHandler(mockError)).rejects.toEqual(mockError);
      
      // For other errors, should also rethrow
      const otherError = new Error('Other error');
      await expect(errorHandler(otherError)).rejects.toEqual(otherError);
    });
  });
});