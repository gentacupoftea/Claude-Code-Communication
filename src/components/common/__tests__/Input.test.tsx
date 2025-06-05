import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Input from '../Input';
import { Mail, Search } from 'lucide-react';

describe('Input Component', () => {
  test('renders with default props', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('w-full');
  });

  test('renders with label', () => {
    render(<Input label="Email Address" placeholder="email@example.com" />);
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  test('renders with error message', () => {
    render(<Input error="This field is required" />);
    const errorMessage = screen.getByText('This field is required');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveClass('text-red-400');
  });

  test('applies error styling when error is present', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('renders with left icon', () => {
    render(<Input leftIcon={<Mail data-testid="mail-icon" />} />);
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pl-10');
  });

  test('renders with right icon', () => {
    render(<Input rightIcon={<Search data-testid="search-icon" />} />);
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pr-10');
  });

  test('renders with both left and right icons', () => {
    render(
      <Input 
        leftIcon={<Mail data-testid="mail-icon" />}
        rightIcon={<Search data-testid="search-icon" />}
      />
    );
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pl-10', 'pr-10');
  });

  test('applies fullWidth prop', () => {
    render(<Input fullWidth />);
    const wrapper = screen.getByRole('textbox').parentElement?.parentElement;
    expect(wrapper).toHaveClass('w-full');
  });

  test('applies custom className', () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-input');
  });

  test('forwards input props correctly', () => {
    render(
      <Input 
        type="email"
        required
        data-testid="email-input"
        maxLength={50}
      />
    );
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('maxLength', '50');
  });

  test('handles input change events', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'test input' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test('handles focus and blur events', () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
    
    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  test('generates unique id when not provided', () => {
    const { unmount } = render(<Input label="First Input" />);
    const firstInput = screen.getByLabelText('First Input');
    const firstId = firstInput.getAttribute('id');
    
    unmount();
    render(<Input label="Second Input" />);
    const secondInput = screen.getByLabelText('Second Input');
    const secondId = secondInput.getAttribute('id');
    
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  test('uses provided id', () => {
    render(<Input id="custom-id" label="Custom ID Input" />);
    const input = screen.getByLabelText('Custom ID Input');
    expect(input).toHaveAttribute('id', 'custom-id');
  });

  test('connects label with input via htmlFor', () => {
    render(<Input label="Test Label" />);
    const label = screen.getByText('Test Label');
    const input = screen.getByLabelText('Test Label');
    expect(label).toHaveAttribute('for', input.getAttribute('id'));
  });

  test('connects error message with input via aria-describedby', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    const errorId = `${input.getAttribute('id')}-error`;
    expect(input).toHaveAttribute('aria-describedby', errorId);
    expect(screen.getByText('Error message')).toHaveAttribute('id', errorId);
  });

  test('error message has proper accessibility attributes', () => {
    render(<Input error="Validation error" />);
    const errorMessage = screen.getByText('Validation error');
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  test('applies focus styles correctly', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('focus:outline-none', 'focus:border-[#1ABC9C]');
  });

  test('container sizing with fullWidth false', () => {
    render(<Input fullWidth={false} />);
    const wrapper = screen.getByRole('textbox').parentElement?.parentElement;
    expect(wrapper).toHaveClass('max-w-md');
  });

  test('maintains input value', () => {
    render(<Input value="initial value" readOnly />);
    const input = screen.getByDisplayValue('initial value');
    expect(input).toBeInTheDocument();
  });

  test('handles disabled state', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  test('renders without label or error', () => {
    render(<Input placeholder="Just input" />);
    expect(screen.getByPlaceholderText('Just input')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('icon positioning in container', () => {
    render(
      <Input 
        leftIcon={<Mail data-testid="left-icon" />}
        rightIcon={<Search data-testid="right-icon" />}
      />
    );
    
    const leftIcon = screen.getByTestId('left-icon');
    const rightIcon = screen.getByTestId('right-icon');
    
    expect(leftIcon.closest('div')).toHaveClass('absolute', 'left-3');
    expect(rightIcon.closest('div')).toHaveClass('absolute', 'right-3');
  });

  test('preserves all standard input functionality', () => {
    render(
      <Input 
        type="password"
        autoComplete="current-password"
        name="password"
        form="login-form"
      />
    );
    
    const input = screen.getByDisplayValue('') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autoComplete', 'current-password');
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toHaveAttribute('form', 'login-form');
  });
});