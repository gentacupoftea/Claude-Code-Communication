import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import SalesTrendChart from '../charts/SalesTrendChart';
import CategoryPieChart from '../charts/CategoryPieChart';

const AnalyticsDashboard: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['order-summary'],
    queryFn: async () => {
      const response = await api.get('/analytics/orders/summary');
      return response.data;
    },
  });

  const trendData = [
    { date: 'Mon', sales: 100 },
    { date: 'Tue', sales: 120 },
    { date: 'Wed', sales: 90 },
    { date: 'Thu', sales: 160 },
    { date: 'Fri', sales: 140 },
  ];

  const categoryData = [
    { name: 'Shirts', value: 400 },
    { name: 'Shoes', value: 300 },
    { name: 'Accessories', value: 300 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        Analytics Dashboard
      </h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sales Trend
          </h3>
          <SalesTrendChart data={trendData} />
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sales by Category
          </h3>
          <CategoryPieChart data={categoryData} />
        </div>
      </div>
      {data && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <p>Total Revenue: ${data.total_revenue}</p>
          <p>Total Orders: {data.total_orders}</p>
          <p>Average Order Value: ${data.average_order_value.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
