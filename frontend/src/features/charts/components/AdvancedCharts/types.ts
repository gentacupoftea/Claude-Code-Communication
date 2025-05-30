// 共通の型定義
export interface ChartProps {
  data: any[];
  width?: number;
  height?: number;
  title?: string;
  onExport?: (format: 'png' | 'svg') => void;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export const defaultDimensions: ChartDimensions = {
  width: 600,
  height: 400,
  margin: {
    top: 20,
    right: 20,
    bottom: 50,
    left: 50,
  },
};

// Coneaブランドカラー
export const coneaColors = {
  primary: '#34d399',
  secondary: '#10b981',
  tertiary: '#059669',
  quaternary: '#047857',
  quinary: '#065f46',
  gradient: ['#34d399', '#10b981', '#059669', '#047857', '#065f46'],
  heatmap: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
};