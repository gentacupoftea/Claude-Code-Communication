import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend = 'neutral',
  trendValue,
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (trend === 'down') {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          {icon}
        </div>
        {trendValue !== undefined && (
          <div className={`flex items-center space-x-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
              {trendValue.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
};

export default MetricCard;