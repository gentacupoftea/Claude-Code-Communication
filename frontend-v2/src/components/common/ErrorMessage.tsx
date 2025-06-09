/**
 * Error Message Component
 * エラー状態を表示するコンポーネント
 */

import React from 'react';

interface ErrorMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  onClose?: () => void;
  closable?: boolean;
  title?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  type = 'error',
  className = '',
  onClose,
  closable = false,
  title,
}) => {
  const typeStyles = {
    error: {
      container: 'bg-red-50 border border-red-200 text-red-800',
      icon: '❌',
      iconColor: 'text-red-500',
    },
    warning: {
      container: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
      icon: '⚠️',
      iconColor: 'text-yellow-500',
    },
    info: {
      container: 'bg-blue-50 border border-blue-200 text-blue-800',
      icon: 'ℹ️',
      iconColor: 'text-blue-500',
    },
  };

  const styles = typeStyles[type];

  return (
    <div className={`rounded-md p-4 ${styles.container} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className={`text-lg ${styles.iconColor}`} role="img" aria-label={type}>
            {styles.icon}
          </span>
        </div>
        <div className="ml-3 flex-grow">
          {title && (
            <h3 className="text-sm font-medium mb-1">{title}</h3>
          )}
          <p className="text-sm">{message}</p>
        </div>
        {closable && onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex rounded-md p-1.5 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  type === 'error' 
                    ? 'hover:bg-red-100 focus:ring-red-600' 
                    : type === 'warning'
                    ? 'hover:bg-yellow-100 focus:ring-yellow-600'
                    : 'hover:bg-blue-100 focus:ring-blue-600'
                }`}
                aria-label="エラーメッセージを閉じる"
              >
                <span className="sr-only">閉じる</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 便利なプリセット
export const ErrorAlert: React.FC<{ 
  message: string; 
  className?: string; 
  onClose?: () => void;
  title?: string;
}> = ({ message, className, onClose, title }) => (
  <ErrorMessage 
    message={message} 
    type="error" 
    className={className} 
    onClose={onClose}
    closable={!!onClose}
    title={title}
  />
);

export const WarningAlert: React.FC<{ 
  message: string; 
  className?: string; 
  onClose?: () => void;
  title?: string;
}> = ({ message, className, onClose, title }) => (
  <ErrorMessage 
    message={message} 
    type="warning" 
    className={className} 
    onClose={onClose}
    closable={!!onClose}
    title={title}
  />
);

export const InfoAlert: React.FC<{ 
  message: string; 
  className?: string; 
  onClose?: () => void;
  title?: string;
}> = ({ message, className, onClose, title }) => (
  <ErrorMessage 
    message={message} 
    type="info" 
    className={className} 
    onClose={onClose}
    closable={!!onClose}
    title={title}
  />
);

// インライン使用向けのシンプルなエラー表示
export const InlineError: React.FC<{ message: string; className?: string }> = ({ 
  message, 
  className 
}) => (
  <span className={`text-sm text-red-600 ${className}`}>
    ❌ {message}
  </span>
);

export default ErrorMessage;