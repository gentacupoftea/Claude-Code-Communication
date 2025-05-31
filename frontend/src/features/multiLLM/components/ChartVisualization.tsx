import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ChartVisualizationProps {
  data: any;
}

export function ChartVisualization({ data }: ChartVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    // 既存のチャートを破棄
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // 新しいチャートを作成
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      chartRef.current = new Chart(ctx, {
        type: data.chartType || 'bar',
        data: data.chartConfig?.data || {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...data.chartConfig?.options
        }
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  if (!data) return null;

  return (
    <div className="chart-container">
      <h4>{data.chartConfig?.title || 'データ可視化'}</h4>
      <div className="chart-wrapper">
        <canvas ref={canvasRef}></canvas>
      </div>
      {data.description && (
        <p className="chart-description">{data.description}</p>
      )}
    </div>
  );
}