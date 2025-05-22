import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryPieChartProps {
  data?: { name: string; value: number }[];
  chartType?: 'pie' | 'donut';
  height?: number;
}

const COLORS = ['#4ade80', '#60a5fa', '#f97316', '#f43f5e', '#a78bfa'];

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ 
  data = [],
  chartType = 'pie',
  height = 300
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie 
        data={data} 
        dataKey="value" 
        nameKey="name" 
        outerRadius={100} 
        innerRadius={chartType === 'donut' ? 40 : 0}
        label
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);

export default CategoryPieChart;
