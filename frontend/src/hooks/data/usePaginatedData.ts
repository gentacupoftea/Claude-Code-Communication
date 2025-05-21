import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

/**
 * Types for pagination parameters
 */
export interface PaginationParams {
  page: number;
  perPage: number;
  totalItems?: number;
  totalPages?: number;
}

/**
 * Types for sorting parameters
 */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Types for filtering parameters
 */
export interface FilterParams {
  [key: string]: any;
}

/**
 * Types for paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Status of data fetching
 */
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Options for usePaginatedData hook
 */
interface UsePaginatedDataOptions<T> {
  url: string;
  initialPagination?: Partial<PaginationParams>;
  initialSort?: SortParams;
  initialFilters?: FilterParams;
  transform?: (data: any[]) => T[];
  dependencies?: any[];
  autoFetch?: boolean;
  cacheKey?: string;
  cacheTime?: number;
  onSuccess?: (data: PaginatedResponse<T>) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
interface UsePaginatedDataResult<T> {
  data: T[];
  pagination: PaginationParams;
  sort: SortParams | null;
  filters: FilterParams;
  status: FetchStatus;
  error: Error | null;
  loading: boolean;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  setSort: (field: string, direction: 'asc' | 'desc') => void;
  setFilters: (filters: FilterParams) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching paginated data
 */
function usePaginatedData<T = any>({
  url,
  initialPagination = { page: 1, perPage: 10 },
  initialSort,
  initialFilters = {},
  transform,
  dependencies = [],
  autoFetch = true,
  cacheKey,
  cacheTime = 5 * 60 * 1000, // 5 minutes
  onSuccess,
  onError,
}: UsePaginatedDataOptions<T>): UsePaginatedDataResult<T> {
  // State
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationParams>({
    page: initialPagination.page || 1,
    perPage: initialPagination.perPage || 10,
    totalItems: initialPagination.totalItems,
    totalPages: initialPagination.totalPages,
  });
  const [sort, setSort] = useState<SortParams | null>(initialSort || null);
  const [filters, setFiltersState] = useState<FilterParams>(initialFilters);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  
  // Auth context
  const { isAuthenticated } = useAuth();
  
  /**
   * Fetch data from API
   */
  const fetchData = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) return;
    
    setStatus('loading');
    setError(null);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('page', pagination.page.toString());
    queryParams.append('perPage', pagination.perPage.toString());
    
    // Add sort parameters
    if (sort) {
      queryParams.append('sortField', sort.field);
      queryParams.append('sortDirection', sort.direction);
    }
    
    // Add filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, String(value));
      }
    });
    
    // Check cache first if cacheKey is provided
    const currentCacheKey = cacheKey ? 
      `${cacheKey}_${queryParams.toString()}` : undefined;
    
    if (currentCacheKey) {
      const cachedData = localStorage.getItem(`data_cache_${currentCacheKey}`);
      if (cachedData) {
        try {
          const { data: cacheData, expiry } = JSON.parse(cachedData);
          
          // Check if cache is still valid
          if (expiry > Date.now()) {
            const transformedData = transform ? transform(cacheData.data) : cacheData.data;
            setData(transformedData);
            setPagination(cacheData.pagination);
            setStatus('success');
            onSuccess?.({
              data: transformedData,
              pagination: cacheData.pagination,
            });
            return;
          }
        } catch (e) {
          // Invalid cache format, proceed with fetch
          console.warn('Invalid cache format:', e);
        }
      }
    }
    
    try {
      // Fetch data from API
      const endpoint = `${url}?${queryParams.toString()}`;
      const response = await apiService.get<PaginatedResponse<T>>(endpoint);
      
      if (!response || !response.data || !response.pagination) {
        throw new Error('Invalid response format from API');
      }
      
      // Transform data if needed
      const transformedData = transform ? transform(response.data) : response.data;
      
      // Update state
      setData(transformedData);
      setPagination(response.pagination);
      setStatus('success');
      
      // Cache response if cacheKey is provided
      if (currentCacheKey) {
        localStorage.setItem(
          `data_cache_${currentCacheKey}`,
          JSON.stringify({
            data: response,
            expiry: Date.now() + cacheTime,
          })
        );
      }
      
      // Call success callback
      onSuccess?.({
        data: transformedData,
        pagination: response.pagination,
      });
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      setStatus('error');
      
      // Call error callback
      onError?.(fetchError);
    }
  }, [
    url,
    pagination.page,
    pagination.perPage,
    sort,
    filters,
    isAuthenticated,
    transform,
    cacheKey,
    cacheTime,
    onSuccess,
    onError,
  ]);
  
  /**
   * Fetch data when dependencies change
   */
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [fetchData, autoFetch, ...dependencies]);
  
  /**
   * Update page number
   */
  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);
  
  /**
   * Update items per page
   */
  const setPerPage = useCallback((perPage: number) => {
    setPagination((prev) => ({ ...prev, page: 1, perPage }));
  }, []);
  
  /**
   * Update sort parameters
   */
  const setSortParams = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSort({ field, direction });
  }, []);
  
  /**
   * Update filters
   */
  const setFilters = useCallback((newFilters: FilterParams) => {
    setFiltersState(newFilters);
    // Reset to first page when filters change
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);
  
  /**
   * Reset filters
   */
  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    // Reset to first page when filters are reset
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [initialFilters]);
  
  return {
    data,
    pagination,
    sort,
    filters,
    status,
    error,
    loading: status === 'loading',
    setPage,
    setPerPage,
    setSort: setSortParams,
    setFilters,
    resetFilters,
    refetch: fetchData,
  };
}

export default usePaginatedData;