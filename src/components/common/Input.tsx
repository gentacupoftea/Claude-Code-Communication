import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseClasses = `
    w-full bg-white/10 border rounded-lg transition-all duration-200
    focus:outline-none focus:ring-4 focus:ring-[#1ABC9C]/20
    text-white placeholder-gray-400
    ${error ? 'border-red-400 focus:border-red-300' : 'border-white/20 focus:border-[#1ABC9C]'}
    ${leftIcon ? 'pl-10' : 'px-3 sm:px-4'}
    ${rightIcon ? 'pr-10' : 'px-3 sm:px-4'}
    py-2 sm:py-3
  `;

  return (
    <div className={fullWidth ? 'w-full' : 'max-w-md'}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-2 text-gray-200"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${baseClasses} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p 
          id={`${inputId}-error`}
          className="mt-1 text-sm text-red-400"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
});