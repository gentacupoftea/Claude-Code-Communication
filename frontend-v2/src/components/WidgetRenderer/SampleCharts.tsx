'use client';

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { LineChart as LineChartIcon, BarChart as BarChartIcon, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const ChartPlaceholder = styled(Paper)(({ theme }) => ({
  width: '100%',
  height: '100%',
  minHeight: '400px',
  minWidth: '600px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  gap: '16px',
  position: 'relative',
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 700,
  color: '#34d399',
}));

const sampleLineData = [
  { name: '1月', value: 4000 },
  { name: '2月', value: 3000 },
  { name: '3月', value: 2000 },
  { name: '4月', value: 2780 },
  { name: '5月', value: 1890 },
  { name: '6月', value: 2390 },
];

export const LineChart: React.FC = () => {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={600}>
      <RechartsLineChart data={sampleLineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

const sampleBarData = [
  { name: '商品A', sales: 4000 },
  { name: '商品B', sales: 3000 },
  { name: '商品C', sales: 2000 },
  { name: '商品D', sales: 2780 },
  { name: '商品E', sales: 1890 },
];

export const BarChart: React.FC = () => {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={600}>
      <RechartsBarChart data={sampleBarData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="sales" fill="#34d399" />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

const samplePieData = [
  { name: 'カテゴリA', value: 400 },
  { name: 'カテゴリB', value: 300 },
  { name: 'カテゴリC', value: 300 },
  { name: 'カテゴリD', value: 200 },
];

const COLORS = ['#34d399', '#60a5fa', '#f87171', '#fbbf24'];

export const PieChart: React.FC = () => {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={600}>
      <RechartsPieChart>
        <Pie
          data={samplePieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {samplePieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

export const MetricsCard: React.FC = () => {
  return (
    <ChartPlaceholder elevation={0}>
      <TrendingUp size={48} color="#34d399" />
      <MetricValue>¥1,234,567</MetricValue>
      <Typography variant="h6" color="text.secondary">
        売上高
      </Typography>
      <Typography variant="body2" color="success.main">
        +12.5% 前月比
      </Typography>
    </ChartPlaceholder>
  );
};