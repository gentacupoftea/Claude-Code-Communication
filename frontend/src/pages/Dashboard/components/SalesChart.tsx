import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { ChartData } from '../../../types';

interface SalesChartProps {
  data: ChartData | null | Array<{
    date: string;
    amount: number;
  }>;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  // データの型を確認して適切な形式に変換
  let chartData: Array<{ date: string; amount: number }> = [];
  
  if (Array.isArray(data)) {
    chartData = data;
  } else if (data && 'labels' in data && 'datasets' in data) {
    // ChartData型の場合は変換
    chartData = data.labels.map((label, index) => ({
      date: label,
      amount: data.datasets[0]?.data[index] || 0,
    }));
  }
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};