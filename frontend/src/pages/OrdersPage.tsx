import React, { useState, useMemo } from 'react';
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
  const [statusFilter, setStatusFilter] = useState('');
  
  // Fetch orders data with mock data
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      // Return mock data
      const isMockMode = process.env.REACT_APP_USE_MOCK_AUTH === 'true';
      if (isMockMode) {
        const mockOrders = [
          {
            id: '1',
            name: '10234',
            email: 'sarah.johnson@example.com',
            totalPrice: 12900,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
          },
          {
            id: '2',
            name: '10233',
            email: 'yamada.hanako@example.com',
            totalPrice: 8500,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Unfulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          },
          {
            id: '3',
            name: '10232',
            email: 'michael.chen@example.com',
            totalPrice: 23500,
            financialStatus: 'Pending',
            fulfillmentStatus: 'Unfulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
          },
          {
            id: '4',
            name: '10231',
            email: 'lisa.park@example.com',
            totalPrice: 45000,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          },
          {
            id: '5',
            name: '10230',
            email: 'john.smith@example.com',
            totalPrice: 15600,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
          },
        ];
        
        return {
          orders: mockOrders,
          total: mockOrders.length,
          totalPages: Math.ceil(mockOrders.length / 10),
        };
      }
      
      // API call would go here
      const response = await api.get('/api/v1/orders');
      
      return {
        orders: response.data.orders.map((order: any) => ({
          id: order.id,
          name: order.orderNumber,
          email: order.customer.email,
          totalPrice: order.totalAmount,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          createdAt: new Date(order.createdAt),
        })),
        total: response.data.total,
        totalPages: response.data.totalPages,
      };
    },
  });

  // Filter data based on search and status
  const data = useMemo(() => {
    if (!rawData) return null;
    
    let filtered = [...rawData.orders];
    
    // Apply search filter
    if (search) {
      filtered = filtered.filter(order => 
        order.name.toLowerCase().includes(search.toLowerCase()) || 
        order.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(order => 
        order.financialStatus.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    // Paginate
    const startIndex = (page - 1) * 10;
    const endIndex = startIndex + 10;
    
    return {
      orders: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / 10),
    };
  }, [rawData, search, statusFilter, page]);

  // Export to CSV function
  const exportToCSV = () => {
    if (!data || !data.orders || data.orders.length === 0) {
      alert('No orders to export');
      return;
    }

    // Create CSV content
    const headers = ['Order ID', 'Customer Email', 'Date', 'Payment Status', 'Fulfillment Status', 'Total'];
    const csvContent = [
      headers.join(','),
      ...data.orders.map(order => [
        order.name,
        order.email,
        formatDate(order.createdAt, 'yyyy-MM-dd'),
        order.financialStatus,
        order.fulfillmentStatus,
        order.totalPrice
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${formatDate(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset to first page when search changes
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1a1a1a] dark:text-white"
          />
          
          <select 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1); // Reset to first page when filter changes
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1a1a1a] dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <button 
          onClick={exportToCSV}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
          disabled={!data || data.orders.length === 0}
        >
          Export to CSV
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
              data?.orders?.map((order: any) => (
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