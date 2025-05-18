import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface CategoryData {
  category: string;
  sales: number;
  percentage?: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
}

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#06B6D4', // Cyan
];

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
  // Calculate percentages
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const dataWithPercentages = data.map((item) => ({
    ...item,
    percentage: (item.sales / totalSales) * 100,
  }));

  // Take top 8 categories and group others
  const topCategories = dataWithPercentages.slice(0, 8);
  const otherCategories = dataWithPercentages.slice(8);
  
  if (otherCategories.length > 0) {
    const otherSales = otherCategories.reduce((sum, item) => sum + item.sales, 0);
    const otherPercentage = otherCategories.reduce((sum, item) => sum + (item.percentage || 0), 0);
    
    topCategories.push({
      category: 'Others',
      sales: otherSales,
      percentage: otherPercentage,
    });
  }

  const renderCustomLabel = (entry: CategoryData) => {
    if (entry.percentage && entry.percentage > 5) {
      return `${entry.percentage.toFixed(1)}%`;
    }
    return '';
  };

  const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={topCategories}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="sales"
        >
          {topCategories.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
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
          formatter={(value) => (
            <span className="text-sm text-gray-900 dark:text-gray-300">
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CategoryPieChart;