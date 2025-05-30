import React, { useMemo, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartProps, coneaColors } from './types';
import { exportChart } from './utils';

interface CorrelationData {
  x: string;
  y: string;
  value: number;
}

interface CorrelationMatrixProps extends ChartProps {
  data: CorrelationData[];
}

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  data,
  width = 600,
  height = 600,
  title = '相関行列',
  onExport,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const { matrix, labels } = useMemo(() => {
    const uniqueLabels = Array.from(new Set(data.flatMap(d => [d.x, d.y]))).sort();
    const matrixData: number[][] = uniqueLabels.map(() => 
      uniqueLabels.map(() => 0)
    );

    data.forEach(d => {
      const xIndex = uniqueLabels.indexOf(d.x);
      const yIndex = uniqueLabels.indexOf(d.y);
      if (xIndex !== -1 && yIndex !== -1) {
        matrixData[yIndex][xIndex] = d.value;
      }
    });

    return { matrix: matrixData, labels: uniqueLabels };
  }, [data]);

  const cellSize = Math.min((width - 100) / labels.length, (height - 100) / labels.length);

  const getColor = (value: number) => {
    const index = Math.floor((value + 1) * 4.99); // -1 to 1 を 0 to 9 にマッピング
    return coneaColors.heatmap[Math.max(0, Math.min(9, index))];
  };

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `correlation-matrix.${format}`);
      onExport(format);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom align="center">
        {title}
      </Typography>
      <Box ref={chartRef} sx={{ width, height, position: 'relative' }}>
        <svg width={width} height={height}>
          <g transform={`translate(80, 80)`}>
            {/* セル */}
            {matrix.map((row, rowIndex) =>
              row.map((value, colIndex) => (
                <g key={`${rowIndex}-${colIndex}`}>
                  <rect
                    x={colIndex * cellSize}
                    y={rowIndex * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={getColor(value)}
                    stroke="#fff"
                    strokeWidth="1"
                  />
                  <text
                    x={colIndex * cellSize + cellSize / 2}
                    y={rowIndex * cellSize + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill={Math.abs(value) > 0.5 ? '#fff' : '#000'}
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              ))
            )}

            {/* X軸ラベル */}
            {labels.map((label, index) => (
              <text
                key={`x-${index}`}
                x={index * cellSize + cellSize / 2}
                y={-10}
                textAnchor="middle"
                fontSize="12"
                transform={`rotate(-45, ${index * cellSize + cellSize / 2}, -10)`}
              >
                {label}
              </text>
            ))}

            {/* Y軸ラベル */}
            {labels.map((label, index) => (
              <text
                key={`y-${index}`}
                x={-10}
                y={index * cellSize + cellSize / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
              >
                {label}
              </text>
            ))}
          </g>

          {/* カラースケール */}
          <g transform={`translate(${width - 60}, 80)`}>
            {coneaColors.heatmap.map((color, index) => (
              <rect
                key={index}
                x={0}
                y={index * 20}
                width={20}
                height={20}
                fill={color}
              />
            ))}
            <text x={25} y={10} fontSize="12">1.0</text>
            <text x={25} y={100} fontSize="12">0.0</text>
            <text x={25} y={190} fontSize="12">-1.0</text>
          </g>
        </svg>
      </Box>
    </Paper>
  );
};

export default CorrelationMatrix;