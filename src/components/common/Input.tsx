import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const baseStyles = 'w-full px-3 py-2 bg-white/10 border rounded-lg transition-colors focus:outline-none';
  const normalStyles = 'border-white/20 focus:border-[#1ABC9C] text-white placeholder-gray-400';
  const errorStyles = 'border-red-500 focus:border-red-400 text-white placeholder-red-300';

  const inputClasses = [
    baseStyles,
    error ? errorStyles : normalStyles,
    leftIcon && 'pl-10',
    rightIcon && 'pr-10',
    !fullWidth && 'max-w-md',
    className
  ].filter(Boolean).join(' ');

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
          id={inputId}
          className={inputClasses}
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
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;