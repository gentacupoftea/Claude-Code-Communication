import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';
import { renderWithProviders } from '../../../tests/utils/renderWithProviders';
import * as authHooks from '../../../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../../../hooks/useAuth', async () => {
  const actual = await vi.importActual('../../../hooks/useAuth');
  return {
    ...actual,
    useAuth: vi.fn()
  };
});

describe('LoginForm', () => {
  const mockLogin = vi.fn();
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup default mock implementation
    vi.mocked(authHooks.useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
      error: null,
      user: null
    });
  });

  it('renders the login form correctly', () => {
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByText(/Sign in to your Shopify store/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shop domain/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('validates shop domain format', async () => {
    renderWithProviders(<LoginForm />);
    const user = userEvent.setup();
    
    const input = screen.getByLabelText(/Shop domain/i);
    const submitButton = screen.getByRole('button', { name: /Sign in/i });
    
    // Test with invalid domain
    await user.type(input, 'invalid-domain');
    await user.click(submitButton);
    
    expect(await screen.findByText(/Please enter a valid Shopify shop domain/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
    
    // Clear input and test with valid domain
    await user.clear(input);
    await user.type(input, 'valid-shop.myshopify.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('valid-shop.myshopify.com');
    });
  });

  it('displays loading state during authentication', async () => {
    // Setup loading state
    vi.mocked(authHooks.useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      isLoading: true,
      isAuthenticated: false,
      error: null,
      user: null
    });
    
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeDisabled();
    expect(screen.getByText(/Connecting to Shopify.../i)).toBeInTheDocument();
  });

  it('displays error message when authentication fails', async () => {
    // Setup error state
    vi.mocked(authHooks.useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
      error: 'Authentication failed. Please try again.',
      user: null
    });
    
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByText(/Authentication failed. Please try again./i)).toBeInTheDocument();
  });

  it('redirects when already authenticated', async () => {
    // Setup authenticated state
    vi.mocked(authHooks.useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      error: null,
      user: { id: '1', shopName: 'Test Shop' }
    });
    
    const { container } = renderWithProviders(<LoginForm />, {
      routes: [
        { path: '/dashboard', element: <div data-testid="dashboard">Dashboard Page</div> }
      ]
    });
    
    // Should redirect and not render form
    expect(container.querySelector('form')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});