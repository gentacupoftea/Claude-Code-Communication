import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#1ABC9C] text-white hover:bg-[#16A085] focus:ring-[#1ABC9C] shadow-sm hover:shadow-md transform hover:scale-[1.02]',
    secondary: 'bg-[#3498DB] text-white hover:bg-[#2980B9] focus:ring-[#3498DB] shadow-sm hover:shadow-md',
    outline: 'border border-[#1ABC9C] text-[#1ABC9C] hover:bg-[#1ABC9C] hover:text-white focus:ring-[#1ABC9C]',
    ghost: 'text-gray-300 hover:text-white hover:bg-white/10 focus:ring-white/20'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-base rounded-lg',
    lg: 'px-6 py-3 text-lg rounded-xl'
  };

  const buttonClasses = [
    baseStyles,
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
      )}
      {!loading && leftIcon && (
        <span className="mr-2 flex items-center">{leftIcon}</span>
      )}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
      {!loading && rightIcon && (
        <span className="ml-2 flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};

export default Button;