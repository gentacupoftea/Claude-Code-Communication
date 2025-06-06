import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onAnimationEnd'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-semibold rounded-full
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
  `;

  const variants = {
    primary: `
      bg-[#1ABC9C] text-white hover:bg-[#16A085] focus:ring-[#1ABC9C]
      transform hover:scale-105 shadow-md hover:shadow-lg
    `,
    secondary: `
      bg-[#3498DB] text-white hover:bg-[#2980B9] focus:ring-[#3498DB]
      transform hover:scale-105 shadow-md hover:shadow-lg
    `,
    outline: `
      border border-[#1ABC9C] text-[#1ABC9C] bg-transparent
      hover:bg-[#1ABC9C]/10 focus:ring-[#1ABC9C]
    `,
    ghost: `
      text-gray-300 bg-transparent hover:bg-white/10 hover:text-white
      focus:ring-gray-400
    `
  };

  const _sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const responsiveSizes = {
    sm: 'px-3 sm:px-4 py-2 text-xs sm:text-sm',
    md: 'px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base',
    lg: 'px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg'
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${responsiveSizes[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...(props as Record<string, unknown>)}
    >
      {loading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
      )}
      {leftIcon && !loading && (
        <span className="mr-2" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <span>{children}</span>
      {rightIcon && !loading && (
        <span className="ml-2" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </motion.button>
  );
};