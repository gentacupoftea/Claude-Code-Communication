import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface SalesTrendChartProps {
  currentData: Array<{ date: string; sales: number }>;
  previousData?: Array<{ date: string; sales: number }>;
  growthRate?: number;
}

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  currentData,
  previousData,
  growthRate,
}) => {
  // Combine current and previous data for the chart
  const combinedData = currentData.map((item, index) => {
    const prevItem = previousData?.[index];
    return {
      date: format(parseISO(item.date), 'MMM dd'),
      current: item.sales,
      previous: prevItem?.sales || null,
    };
  });

  const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`;

  return (
    <div className="w-full h-full">
      {growthRate !== undefined && (
        <div className="mb-4 flex items-center justify-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Year-over-year growth:
          </span>
          <span
            className={`ml-2 text-lg font-bold ${
              growthRate > 0
                ? 'text-green-600'
                : growthRate < 0
                ? 'text-red-600'
                : 'text-gray-600'
            }`}
          >
            {growthRate > 0 ? '+' : ''}
            {growthRate.toFixed(1)}%
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={combinedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            style={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
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
          <Line
            type="monotone"
            dataKey="current"
            stroke="#3B82F6"
            strokeWidth={2}
            name="Current Period"
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          {previousData && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#9CA3AF"
              strokeWidth={2}
              name="Previous Year"
              strokeDasharray="5 5"
              dot={{ fill: '#9CA3AF', r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesTrendChart;