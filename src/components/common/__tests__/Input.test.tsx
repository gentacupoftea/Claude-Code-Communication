import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Input } from '../Input';
import { Mail, Search, Eye } from 'lucide-react';

describe('Input', () => {
  it('renders input field correctly', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('renders with label when provided', () => {
    render(<Input label="Email Address" />);
    
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('associates label with input using htmlFor and id', () => {
    render(<Input label="Username" id="username-input" />);
    
    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');
    
    expect(label).toHaveAttribute('for', 'username-input');
    expect(input).toHaveAttribute('id', 'username-input');
  });

  it('generates unique id when not provided', () => {
    const { rerender } = render(<Input label="First Input" />);
    const firstInput = screen.getByRole('textbox');
    const firstId = firstInput.getAttribute('id');
    
    rerender(<Input label="Second Input" />);
    const secondInput = screen.getByRole('textbox');
    const secondId = secondInput.getAttribute('id');
    
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  it('displays error message when provided', () => {
    render(<Input label="Email" error="Please enter a valid email" />);
    
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('associates error message with input using aria-describedby', () => {
    render(<Input label="Email" error="Invalid email" id="email-input" />);
    
    const input = screen.getByRole('textbox');
    const errorMessage = screen.getByText('Invalid email');
    
    expect(input).toHaveAttribute('aria-describedby', 'email-input-error');
    expect(errorMessage).toHaveAttribute('id', 'email-input-error');
  });

  it('sets aria-invalid when error is present', () => {
    const { rerender } = render(<Input />);
    let input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    
    rerender(<Input error="Error message" />);
    input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies error styles when error is present', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    
    expect(input).toHaveClass('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
  });

  it('renders left icon', () => {
    render(<Input leftIcon={<Mail data-testid="mail-icon" />} />);
    
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pl-10');
  });

  it('renders right icon', () => {
    render(<Input rightIcon={<Search data-testid="search-icon" />} />);
    
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pr-10');
  });

  it('adjusts padding when both icons are present', () => {
    render(
      <Input 
        leftIcon={<Mail data-testid="left-icon" />}
        rightIcon={<Eye data-testid="right-icon" />}
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pl-10', 'pr-10');
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('applies full width when specified', () => {
    render(<Input fullWidth />);
    const container = screen.getByRole('textbox').parentElement?.parentElement;
    expect(container).toHaveClass('w-full');
  });

  it('forwards HTML input attributes', () => {
    render(
      <Input 
        type="email"
        placeholder="Enter your email"
        required
        disabled
        maxLength={50}
        data-testid="email-input"
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'Enter your email');
    expect(input).toHaveAttribute('required');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('maxLength', '50');
    expect(input).toHaveAttribute('data-testid', 'email-input');
  });

  it('handles user input correctly', async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    
    await user.type(input, 'test@example.com');
    
    expect(input).toHaveValue('test@example.com');
    expect(handleChange).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input-class" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-input-class');
  });

  it('has proper focus styles', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    
    expect(input).toHaveClass(
      'focus:outline-none',
      'focus:border-[#1ABC9C]',
      'focus:ring-2',
      'focus:ring-[#1ABC9C]',
      'focus:ring-offset-2',
      'focus:ring-offset-gray-900'
    );
  });

  it('applies responsive text sizing', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('text-sm', 'sm:text-base');
  });

  it('handles different input types', () => {
    const { rerender, container } = render(<Input type="password" />);
    expect(container.querySelector('input')).toHaveAttribute('type', 'password');
    
    rerender(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    
    rerender(<Input type="tel" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'tel');
  });

  it('applies glassmorphic background styling', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    
    expect(input).toHaveClass(
      'bg-white/10',
      'border',
      'border-white/20',
      'rounded-lg',
      'text-white',
      'placeholder-gray-400'
    );
  });

  it('maintains accessibility with icons', () => {
    render(
      <Input 
        label="Search"
        leftIcon={<Search aria-hidden="true" />}
        rightIcon={<Eye aria-hidden="true" />}
      />
    );
    
    const input = screen.getByLabelText('Search');
    expect(input).toBeInTheDocument();
    // Icons should be presentational only
    expect(screen.getByLabelText('Search')).toHaveAccessibleName('Search');
  });

  it('handles ref forwarding', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('displays error with proper ARIA live region', () => {
    render(<Input error="This field is required" />);
    
    const errorElement = screen.getByText('This field is required');
    expect(errorElement).toHaveAttribute('role', 'alert');
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
  });
});