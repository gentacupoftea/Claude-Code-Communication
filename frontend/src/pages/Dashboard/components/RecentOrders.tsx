import React from 'react';
import { DataTable } from '../../../molecules/DataTable/DataTable';
import { Order } from '../../../types';
import { Badge } from '../../../atoms/Badge/Badge';
import { formatDate, formatCurrency } from '../../../utils/format';

interface RecentOrdersProps {
  orders: Order[];
  loading?: boolean;
}

export const RecentOrders: React.FC<RecentOrdersProps> = ({ orders, loading }) => {
  const columns = [
    {
      id: 'orderNumber',
      label: 'Order #',
      format: (value: string) => `#${value}`,
    },
    {
      id: 'customer',
      label: 'Customer',
      format: (value: any) => value?.name || '',
    },
    {
      id: 'createdAt',
      label: 'Date',
      format: (value: string) => formatDate(value),
    },
    {
      id: 'status',
      label: 'Status',
      format: (value: string) => (
        <Badge
          variant="status"
          color={
            value === 'completed' ? 'success' :
            value === 'processing' ? 'info' :
            value === 'cancelled' ? 'error' :
            'warning'
          }
          value={value}
        />
      ),
    },
    {
      id: 'totalAmount',
      label: 'Total',
      format: (value: number) => formatCurrency(value),
      numeric: true,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={orders}
      loading={loading}
      dense
    />
  );
};