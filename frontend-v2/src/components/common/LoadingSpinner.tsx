/**
 * Loading Spinner Component
 * ローディング状態を表示するスピナーコンポーネント
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'blue' | 'gray' | 'white';
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'blue',
  className = '',
  message,
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        <svg
          className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {message && (
          <p className={`mt-2 text-sm ${colorClasses[color]}`}>{message}</p>
        )}
      </div>
    </div>
  );
};

// 便利なプリセット
export const SmallSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <LoadingSpinner size="small" className={className} />
);

export const MediumSpinner: React.FC<{ className?: string; message?: string }> = ({ 
  className, 
  message 
}) => (
  <LoadingSpinner size="medium" className={className} message={message} />
);

export const LargeSpinner: React.FC<{ className?: string; message?: string }> = ({ 
  className, 
  message 
}) => (
  <LoadingSpinner size="large" className={className} message={message} />
);

// インライン使用向けの小さなスピナー
export const InlineSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <LoadingSpinner size="small" className={`inline-block ${className}`} />
);

export default LoadingSpinner;