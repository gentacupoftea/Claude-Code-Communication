'use client';

import React, { useEffect, useRef } from 'react';
import { ChartData } from '@/src/types/analytics';
import { motion } from 'framer-motion';
import { Download, Maximize2, MoreVertical } from 'lucide-react';

interface ChartVisualizationProps {
  chart: ChartData;
  onUpdate?: (chart: ChartData) => void;
  onDelete?: () => void;
}

export const ChartVisualization: React.FC<ChartVisualizationProps> = ({
  chart,
  onUpdate,
  onDelete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Chart.jsの動的インポート
    import('chart.js/auto').then((ChartJS) => {
      const Chart = ChartJS.default;

      // 既存のチャートを破棄
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      // 新しいチャートを作成
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new Chart(ctx, {
        type: chart.type as any,
        data: chart.data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: chart.config?.legend ?? true,
              labels: {
                color: '#fff',
              },
            },
            tooltip: {
              enabled: chart.config?.tooltips ?? true,
            },
          },
          scales: chart.type !== 'pie' && chart.type !== 'radar' ? {
            x: {
              ticks: { color: '#9CA3AF' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
            },
            y: {
              ticks: { color: '#9CA3AF' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
            },
          } : {},
        },
      });
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [chart]);

  const handleExport = () => {
    if (!canvasRef.current) return;
    
    const url = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${chart.title || 'chart'}.png`;
    link.href = url;
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-800/50 backdrop-blur-lg rounded-lg border border-white/10 p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{chart.title}</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="エクスポート"
          >
            <Download className="w-4 h-4 text-gray-400" />
          </button>
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="全画面表示"
          >
            <Maximize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="オプション"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="relative h-64">
        <canvas ref={canvasRef} />
      </div>
    </motion.div>
  );
};