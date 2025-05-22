import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSummary from '../DashboardSummary';
import { renderWithProviders } from '../../../tests/utils/renderWithProviders';
import { useGetDashboardSummary } from '../../../hooks/useDashboard';
import { mockDashboardData } from '../../../tests/mocks/apiMocks';

// Mock the dashboard hook
vi.mock('../../../hooks/useDashboard', () => ({
  useGetDashboardSummary: vi.fn()
}));

describe('DashboardSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup default mock implementation for successful data fetch
    vi.mocked(useGetDashboardSummary).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    });
  });

  it('renders dashboard summary with correct data', async () => {
    renderWithProviders(<DashboardSummary />);
    
    // Check for summary cards
    expect(screen.getByText(/Total Orders/i)).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    
    expect(screen.getByText(/Total Sales/i)).toBeInTheDocument();
    expect(screen.getByText('$9,876.54')).toBeInTheDocument();
    
    expect(screen.getByText(/Average Order Value/i)).toBeInTheDocument();
    expect(screen.getByText('$82.30')).toBeInTheDocument();
    
    expect(screen.getByText(/Conversion Rate/i)).toBeInTheDocument();
    expect(screen.getByText('3.2%')).toBeInTheDocument();
    
    // Check for top products section
    expect(screen.getByText(/Top Products/i)).toBeInTheDocument();
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    expect(screen.getByText('Test Product 3')).toBeInTheDocument();
    
    // Check for recent orders section
    expect(screen.getByText(/Recent Orders/i)).toBeInTheDocument();
    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays loading state while fetching data', async () => {
    // Override the mock to return loading state
    vi.mocked(useGetDashboardSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn()
    });
    
    renderWithProviders(<DashboardSummary />);
    
    // Check for loading indicators
    expect(screen.getAllByTestId('skeleton-loader')).toHaveLength(4); // Four summary cards
    expect(screen.getByText(/Loading dashboard data.../i)).toBeInTheDocument();
  });

  it('displays error message when data fetch fails', async () => {
    // Override the mock to return error state
    vi.mocked(useGetDashboardSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch dashboard data'),
      refetch: vi.fn()
    });
    
    renderWithProviders(<DashboardSummary />);
    
    // Check for error message
    expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('refreshes data when refresh button is clicked', async () => {
    const mockRefetch = vi.fn();
    
    // Override the mock to include refetch function
    vi.mocked(useGetDashboardSummary).mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch
    });
    
    renderWithProviders(<DashboardSummary />);
    const user = userEvent.setup();
    
    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    await user.click(refreshButton);
    
    // Check if refetch was called
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('allows filtering and sorting of products', async () => {
    renderWithProviders(<DashboardSummary />);
    const user = userEvent.setup();
    
    // Test the filter functionality
    const filterInput = screen.getByPlaceholderText(/Filter products/i);
    await user.type(filterInput, 'Product 1');
    
    // Only Product 1 should be visible
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Product 3')).not.toBeInTheDocument();
    
    // Clear filter
    await user.clear(filterInput);
    
    // Test sorting (assuming there's a sort button)
    const sortButton = screen.getByRole('button', { name: /Sort/i });
    await user.click(sortButton);
    
    // Check if sorting was applied (implementation details will depend on your component)
    // This is just a placeholder assertion
    expect(sortButton).toHaveAttribute('aria-pressed', 'true');
  });
});