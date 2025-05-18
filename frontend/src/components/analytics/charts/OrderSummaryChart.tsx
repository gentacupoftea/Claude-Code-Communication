import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface OrderSummaryData {
  period: string;
  order_count: number;
  total_revenue: number;
  average_order_value: number;
  unique_customers: number;
}

interface OrderSummaryChartProps {
  data: OrderSummaryData[];
}

const OrderSummaryChart: React.FC<OrderSummaryChartProps> = ({ data }) => {
  // Format data for the chart
  const chartData = data.map((item) => ({
    period: item.period,
    orders: item.order_count,
    revenue: item.total_revenue,
    aov: item.average_order_value,
  }));

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'revenue' || name === 'aov') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const formatYAxisValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value}`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis
          dataKey="period"
          stroke="#9CA3AF"
          style={{ fontSize: 12 }}
        />
        <YAxis
          yAxisId="left"
          stroke="#9CA3AF"
          style={{ fontSize: 12 }}
          tickFormatter={formatYAxisValue}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#9CA3AF"
          style={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            border: 'none',
            borderRadius: '8px',
            color: '#F3F4F6',
          }}
        />
        <Legend
          wrapperStyle={{
            paddingTop: '20px',
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="#3B82F6"
          name="Revenue"
          radius={[8, 8, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="orders"
          fill="#10B981"
          name="Orders"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default OrderSummaryChart;