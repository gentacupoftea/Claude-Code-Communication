import React, { useRef } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors } from './types';
import { exportChart } from './utils';

interface CrossAnalysisData {
  category: string;
  bar1?: number;
  bar2?: number;
  line1?: number;
  line2?: number;
  [key: string]: any;
}

interface CrossAnalysisProps extends ChartProps {
  data: CrossAnalysisData[];
  barDataKeys?: string[];
  lineDataKeys?: string[];
  barNames?: string[];
  lineNames?: string[];
}

const CrossAnalysis: React.FC<CrossAnalysisProps> = ({
  data,
  width = 800,
  height = 400,
  title = 'クロス分析',
  barDataKeys = ['bar1', 'bar2'],
  lineDataKeys = ['line1', 'line2'],
  barNames = ['データ1', 'データ2'],
  lineNames = ['ライン1', 'ライン2'],
  onExport,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `cross-analysis.${format}`);
      onExport(format);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => handleExport('png')} title="PNG形式でダウンロード">
            <Download />
          </IconButton>
          <IconButton size="small" onClick={() => handleExport('svg')} title="SVG形式でダウンロード">
            <Download />
          </IconButton>
        </Stack>
      </Stack>

      <Box ref={chartRef} sx={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="left" orientation="left" stroke={coneaColors.primary} />
            <YAxis yAxisId="right" orientation="right" stroke={coneaColors.secondary} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${coneaColors.primary}`,
                borderRadius: 4,
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            {/* バーグラフ */}
            {barDataKeys.map((key, index) => (
              <Bar
                key={key}
                yAxisId="left"
                dataKey={key}
                name={barNames[index]}
                fill={coneaColors.gradient[index % coneaColors.gradient.length]}
                opacity={0.8}
              />
            ))}

            {/* ライングラフ */}
            {lineDataKeys.map((key, index) => (
              <Line
                key={key}
                yAxisId="right"
                type="monotone"
                dataKey={key}
                name={lineNames[index]}
                stroke={coneaColors.gradient[(index + 2) % coneaColors.gradient.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default CrossAnalysis;