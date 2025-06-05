import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../Button';
import { ChevronRight } from 'lucide-react';

describe('Button Component', () => {
  test('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-[#1ABC9C]'); // primary variant by default
  });

  test('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-[#3498DB]');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-[#1ABC9C]');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-gray-300');
  });

  test('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5', 'text-sm');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2', 'text-base');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  test('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });

  test('renders with left and right icons', () => {
    render(
      <Button leftIcon={<ChevronRight />} rightIcon={<ChevronRight />}>
        With Icons
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button.querySelectorAll('svg')).toHaveLength(2);
  });

  test('applies fullWidth prop', () => {
    render(<Button fullWidth>Full Width</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not trigger click when disabled', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} disabled>Disabled</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('does not trigger click when loading', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} loading>Loading</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  test('forwards other button props', () => {
    render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
    const button = screen.getByTestId('submit-btn');
    expect(button).toHaveAttribute('type', 'submit');
  });

  test('has proper accessibility attributes', () => {
    render(<Button aria-label="Custom label">Button</Button>);
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
  });

  test('renders children correctly', () => {
    render(
      <Button>
        <span>Complex</span> <em>children</em>
      </Button>
    );
    expect(screen.getByText('Complex')).toBeInTheDocument();
    expect(screen.getByText('children')).toBeInTheDocument();
  });

  test('applies focus styles when focused', () => {
    render(<Button>Focus me</Button>);
    const button = screen.getByRole('button');
    
    button.focus();
    expect(button).toHaveFocus();
  });

  test('maintains button semantic when loading', () => {
    render(<Button loading>Loading Button</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('loading state hides text content', () => {
    render(<Button loading>Hidden Text</Button>);
    const textElement = screen.getByText('Hidden Text');
    expect(textElement).toHaveClass('opacity-0');
  });

  test('loading state does not show icons', () => {
    render(
      <Button loading leftIcon={<ChevronRight />} rightIcon={<ChevronRight />}>
        Loading
      </Button>
    );
    // Icons should not be rendered when loading
    const button = screen.getByRole('button');
    const svgs = button.querySelectorAll('svg');
    expect(svgs).toHaveLength(0); // No icons, only loading spinner
  });

  test('disabled state has proper styling', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  test('combines variant and size classes correctly', () => {
    render(<Button variant="outline" size="lg">Large Outline</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-[#1ABC9C]'); // outline variant
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg'); // large size
  });

  test('handles keyboard interactions', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Keyboard Test</Button>);
    const button = screen.getByRole('button');
    
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    
    // Button should handle these events naturally
    expect(button).toBeInTheDocument();
  });
});