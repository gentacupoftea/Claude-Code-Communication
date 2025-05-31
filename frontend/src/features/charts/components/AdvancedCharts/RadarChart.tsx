import React, { useRef } from 'react';
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors } from './types';
import { exportChart } from './utils';

interface RadarData {
  subject: string;
  [key: string]: string | number;
}

interface RadarChartProps extends ChartProps {
  data: RadarData[];
  dataKeys: string[];
  dataNames?: string[];
}

const RadarChart: React.FC<RadarChartProps> = ({
  data,
  width = 600,
  height = 500,
  title = 'レーダーチャート',
  dataKeys,
  dataNames,
  onExport,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `radar-chart.${format}`);
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
          <RechartsRadarChart data={data}>
            <PolarGrid
              gridType="polygon"
              stroke={coneaColors.primary}
              strokeOpacity={0.2}
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 12 }}
              stroke={coneaColors.secondary}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              stroke={coneaColors.tertiary}
            />

            {dataKeys.map((key, index) => (
              <Radar
                key={key}
                name={dataNames?.[index] || key}
                dataKey={key}
                stroke={coneaColors.gradient[index % coneaColors.gradient.length]}
                fill={coneaColors.gradient[index % coneaColors.gradient.length]}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${coneaColors.primary}`,
                borderRadius: 4,
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default RadarChart;