import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  const getChangeIndicator = () => {
    if (change === undefined) return null;
    
    if (change === 0) {
      return <Minus className="w-4 h-4" />;
    }
    
    return change > 0 
      ? <TrendingUp className="w-4 h-4" />
      : <TrendingDown className="w-4 h-4" />;
  };

  const getChangeColor = () => {
    if (change === undefined) return '';
    
    if (change === 0) return 'text-gray-500';
    
    return change > 0 ? 'text-green-600' : 'text-red-600';
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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatValue(value)}
          </h3>
          
          {change !== undefined && (
            <div className={clsx('flex items-center gap-1 mt-2', getChangeColor())}>
              {getChangeIndicator()}
              <span className="text-sm font-medium">
                {Math.abs(change)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                from last period
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <div className="text-primary-600 dark:text-primary-400">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KpiCard;