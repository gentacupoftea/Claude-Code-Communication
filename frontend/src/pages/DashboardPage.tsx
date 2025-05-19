import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import KpiCard from '../components/dashboard/KpiCard';
import api from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const DashboardPage: React.FC = () => {
  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      // Temporarily return mock data while API is not available
      return {
        totalRevenue: 1234567,
        totalOrders: 89,
        newCustomers: 23,
        conversionRate: 3.4,
      };
    },
  });

  // Mock data for charts
  const salesData = [
    { date: 'Mon', sales: 4000 },
    { date: 'Tue', sales: 3000 },
    { date: 'Wed', sales: 2000 },
    { date: 'Thu', sales: 2780 },
    { date: 'Fri', sales: 1890 },
    { date: 'Sat', sales: 2390 },
    { date: 'Sun', sales: 3490 },
  ];

  const productData = [
    { name: 'Product A', sales: 4000 },
    { name: 'Product B', sales: 3000 },
    { name: 'Product C', sales: 2000 },
    { name: 'Product D', sales: 2780 },
    { name: 'Product E', sales: 1890 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your store's performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={dashboardData?.totalRevenue || 0}
          change={12.5}
          icon={<CurrencyDollarIcon className="h-10 w-10" />}
          loading={isLoading}
          valueFormat="currency"
        />
        <KpiCard
          title="Total Orders"
          value={dashboardData?.totalOrders || 0}
          change={-2.4}
          icon={<ShoppingCartIcon className="h-10 w-10" />}
          loading={isLoading}
        />
        <KpiCard
          title="New Customers"
          value={dashboardData?.newCustomers || 0}
          change={8.1}
          icon={<UserGroupIcon className="h-10 w-10" />}
          loading={isLoading}
        />
        <KpiCard
          title="Conversion Rate"
          value={dashboardData?.conversionRate || 0}
          change={3.2}
          icon={<ArrowTrendingUpIcon className="h-10 w-10" />}
          loading={isLoading}
          valueFormat="percentage"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sales Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Performance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Top Products
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Recent Orders
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {/* Mock orders data */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  #1001
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  John Doe
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  Dec 12, 2023
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Completed
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  $1,234.56
                </td>
              </tr>
              {/* Add more rows as needed */}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;