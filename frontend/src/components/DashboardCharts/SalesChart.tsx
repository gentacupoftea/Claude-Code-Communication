import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Box, Typography } from '@mui/material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SalesData {
  success: boolean;
  dates: string[];
  sales: number[];
  total: number;
  average: number;
  count: number;
}

interface SalesChartProps {
  data: SalesData | null;
  dateRange: string;
}

const SalesChart: React.FC<SalesChartProps> = ({ data, dateRange }) => {
  if (!data || !data.dates || !data.sales) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography variant="body1" color="textSecondary">
          売上データがありません
        </Typography>
      </Box>
    );
  }

  const chartData = {
    labels: data.dates,
    datasets: [
      {
        label: '売上高',
        data: data.sales,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        fill: true,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(75, 192, 192)',
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `売上: ¥${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '¥' + Number(value).toLocaleString();
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6
      }
    }
  };

  return (
    <Box sx={{ height: 300, position: 'relative' }}>
      <Line data={chartData} options={options} />
      <Box sx={{ mt: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="textSecondary">
          📈 データポイント: {data.dates.length} | 期間: {dateRange} | 実データ表示中
        </Typography>
      </Box>
    </Box>
  );
};

export default SalesChart;