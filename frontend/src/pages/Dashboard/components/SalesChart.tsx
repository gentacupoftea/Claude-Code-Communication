import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '@mui/material/styles';

import { ChartData } from '../../../types';

interface SalesChartProps {
  data: ChartData | null | Array<{
    date: string;
    amount: number;
  }>;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
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
    <div style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff', padding: '16px', borderRadius: '8px' }}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
          <XAxis dataKey="date" stroke={isDarkMode ? '#888' : '#666'} />
          <YAxis stroke={isDarkMode ? '#888' : '#666'} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDarkMode ? '#333' : '#fff', 
              border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
              color: isDarkMode ? '#fff' : '#000'
            }} 
          />
          <Legend wrapperStyle={{ color: isDarkMode ? '#888' : '#666' }} />
          <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};