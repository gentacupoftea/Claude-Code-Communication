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
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-2 text-white"
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
          className={`
            w-full bg-white/10 border border-white/20 rounded-lg
            focus:outline-none focus:border-[#1ABC9C] focus:ring-2 focus:ring-[#1ABC9C] focus:ring-offset-2 focus:ring-offset-gray-900
            transition-colors text-white placeholder-gray-400
            ${leftIcon ? 'pl-10' : 'pl-4'} 
            ${rightIcon ? 'pr-10' : 'pr-4'}
            py-3 text-sm sm:text-base
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={errorId}
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
          id={errorId}
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

Input.displayName = 'Input';
