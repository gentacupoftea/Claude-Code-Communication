import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../Button';
import { ChevronRight, Plus } from 'lucide-react';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-[#1ABC9C]', 'text-white');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-[#3498DB]', 'text-white');
  });

  it('applies outline variant styles', () => {
    render(<Button variant="outline">Outline Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'border-[#1ABC9C]', 'text-[#1ABC9C]', 'bg-transparent');
  });

  it('applies ghost variant styles', () => {
    render(<Button variant="ghost">Ghost Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-gray-300', 'bg-transparent');
  });

  it('applies small size styles', () => {
    render(<Button size="sm">Small Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-3', 'sm:px-4', 'py-2', 'text-xs', 'sm:text-sm');
  });

  it('applies medium size styles by default', () => {
    render(<Button>Medium Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'sm:px-6', 'py-2', 'sm:py-3', 'text-sm', 'sm:text-base');
  });

  it('applies large size styles', () => {
    render(<Button size="lg">Large Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'sm:px-8', 'py-3', 'sm:py-4', 'text-base', 'sm:text-lg');
  });

  it('applies full width when specified', () => {
    render(<Button fullWidth>Full Width Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  it('shows loading state with spinner', () => {
    render(<Button loading>Loading Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('[data-lucide="loader-2"]')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Loading Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders left icon', () => {
    render(
      <Button leftIcon={<Plus data-testid="plus-icon" />}>
        Button with left icon
      </Button>
    );
    
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    const button = screen.getByRole('button');
    const icon = screen.getByTestId('plus-icon');
    expect(button).toContainElement(icon);
  });

  it('renders right icon', () => {
    render(
      <Button rightIcon={<ChevronRight data-testid="chevron-icon" />}>
        Button with right icon
      </Button>
    );
    
    expect(screen.getByTestId('chevron-icon')).toBeInTheDocument();
    const button = screen.getByRole('button');
    const icon = screen.getByTestId('chevron-icon');
    expect(button).toContainElement(icon);
  });

  it('hides icons when loading', () => {
    render(
      <Button 
        loading 
        leftIcon={<Plus data-testid="left-icon" />}
        rightIcon={<ChevronRight data-testid="right-icon" />}
      >
        Loading Button
      </Button>
    );
    
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
    expect(screen.getByRole('button').querySelector('[data-lucide="loader-2"]')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Clickable Button</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not handle click when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick} disabled>Disabled Button</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not handle click when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick} loading>Loading Button</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('forwards HTML button attributes', () => {
    render(
      <Button 
        type="submit" 
        form="test-form" 
        aria-label="Submit form"
        data-testid="submit-button"
      >
        Submit
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('form', 'test-form');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
    expect(button).toHaveAttribute('data-testid', 'submit-button');
  });

  it('has proper accessibility attributes', () => {
    render(<Button>Accessible Button</Button>);
    const button = screen.getByRole('button');
    
    // Check for focus management classes
    expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
  });

  it('maintains focus ring for different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-[#1ABC9C]');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-[#3498DB]');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-[#1ABC9C]');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-gray-400');
  });
});