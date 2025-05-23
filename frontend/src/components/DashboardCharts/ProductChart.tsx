import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Box, Typography } from '@mui/material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ProductData {
  success: boolean;
  products: Array<{
    name: string;
    quantity: number;
    revenue: number;
    average_price: number;
  }>;
}

interface ProductChartProps {
  data: ProductData | null;
}

const ProductChart: React.FC<ProductChartProps> = ({ data }) => {
  if (!data || !data.products || data.products.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography variant="body1" color="textSecondary">
          商品データがありません
        </Typography>
      </Box>
    );
  }

  const chartData = {
    labels: data.products.map(p => p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name),
    datasets: [
      {
        label: '売上高',
        data: data.products.map(p => p.revenue),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
          'rgba(199, 199, 199, 0.8)',
          'rgba(83, 102, 255, 0.8)',
          'rgba(255, 99, 255, 0.8)',
          'rgba(99, 255, 132, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 205, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
          'rgba(83, 102, 255, 1)',
          'rgba(255, 99, 255, 1)',
          'rgba(99, 255, 132, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
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
            const product = data.products[context.dataIndex];
            return [
              `売上: ¥${context.parsed.x.toLocaleString()}`,
              `販売数: ${product.quantity}個`,
              `平均価格: ¥${product.average_price.toLocaleString()}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
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
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  return (
    <Box sx={{ height: 300, position: 'relative' }}>
      <Bar data={chartData} options={options} />
      <Box sx={{ mt: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="textSecondary">
          🏆 TOP {data.products.length} 商品 | 実データ表示中
        </Typography>
      </Box>
    </Box>
  );
};

export default ProductChart;