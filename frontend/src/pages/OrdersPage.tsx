import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { formatDate, formatCurrency } from '../utils/date';

interface Order {
  id: string;
  name: string;
  email: string;
  totalPrice: number;
  financialStatus: string;
  fulfillmentStatus: string;
  createdAt: Date;
}

const OrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  // Fetch orders data with mock data
  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search],
    queryFn: async () => {
      // Use mock data while API is not available
      const mockData = await import('../utils/mockData');
      const orders = mockData.mockOrders;
      
      // Filter by search
      const filteredOrders = search
        ? orders.filter(order => 
            order.customer.name.toLowerCase().includes(search.toLowerCase()) ||
            order.customer.email.toLowerCase().includes(search.toLowerCase()) ||
            order.orderNumber.toLowerCase().includes(search.toLowerCase())
          )
        : orders;
      
      // Paginate
      const startIndex = (page - 1) * 10;
      const endIndex = startIndex + 10;
      const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
      
      return {
        orders: paginatedOrders.map(order => ({
          id: order.id,
          name: order.orderNumber,
          email: order.customer.email,
          totalPrice: order.totalAmount,
          financialStatus: order.status === 'delivered' ? 'paid' : 'pending',
          fulfillmentStatus: order.status,
          createdAt: order.createdAt,
        })),
        totalPages: Math.ceil(filteredOrders.length / 10),
      };
    },
  });

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: string } = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      fulfilled: 'bg-blue-100 text-blue-800',
      unfulfilled: 'bg-gray-100 text-gray-800',
    };

    const lowerStatus = status.toLowerCase();
    const className = statusStyles[lowerStatus] || statusStyles.unfulfilled;

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${className}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Orders</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage and track all customer orders
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1a1a1a] dark:text-white"
          />
          
          <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1a1a1a] dark:text-white">
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <button className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
          Export
        </button>
      </div>

      {/* Orders table */}
      <div className="bg-white dark:bg-[#1a1a1a] shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-[#1a1a1a]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Fulfillment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#1a1a1a] divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  <div className="animate-pulse">Loading orders...</div>
                </td>
              </tr>
            ) : data?.orders?.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">
                  No orders found
                </td>
              </tr>
            ) : (
              data?.orders?.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    #{order.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {order.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(order.createdAt, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.financialStatus)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.fulfillmentStatus)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(order.totalPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-primary-600 hover:text-primary-900">
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing page {page} of {data.totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;