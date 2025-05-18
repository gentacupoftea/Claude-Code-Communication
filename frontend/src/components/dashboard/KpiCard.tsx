import React from 'react';
import { clsx } from 'clsx';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  loading?: boolean;
  valueFormat?: 'currency' | 'number' | 'percentage';
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  icon,
  loading = false,
  valueFormat = 'number',
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (valueFormat) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val);
      case 'percentage':
        return `${val}%`;
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatValue(value)}
          </h3>
          
          {change !== undefined && (
            <p
              className={clsx(
                'text-sm mt-1 font-medium',
                change >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change >= 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
        
        {icon && (
          <div className="text-primary-500 dark:text-primary-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default KpiCard;