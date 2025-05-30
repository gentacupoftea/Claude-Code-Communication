'use client';

import React from 'react';
import { Box, Paper, IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { X, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/store/dashboardStore';

// 動的インポート
const CanvasEditor = dynamic(() => import('../CanvasEditor/CanvasEditor'), { ssr: false });
const ProductMetricsCard = dynamic(() => import('../ProductMetricsCard/ProductMetricsCard'), { ssr: false });
const DateRangeSelector = dynamic(() => import('../DateRangeSelector/DateRangeSelector'), { ssr: false });
const ResizableChart = dynamic(() => import('../ResizableChart/ResizableChart'), { ssr: false });

// サンプルグラフコンポーネント
const LineChart = dynamic(() => import('./SampleCharts').then(mod => ({ default: mod.LineChart })), { ssr: false });
const BarChart = dynamic(() => import('./SampleCharts').then(mod => ({ default: mod.BarChart })), { ssr: false });
const PieChart = dynamic(() => import('./SampleCharts').then(mod => ({ default: mod.PieChart })), { ssr: false });
const MetricsCard = dynamic(() => import('./SampleCharts').then(mod => ({ default: mod.MetricsCard })), { ssr: false });

const WidgetContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  borderRadius: '12px',
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.3s ease',
  '&:hover': {
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
}));

const WidgetHeader = styled(Box)(({ theme }) => ({
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#fafafa',
}));

const WidgetContent = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: '16px',
  overflow: 'visible',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

interface WidgetRendererProps {
  widget: {
    id: string;
    type: string;
    title: string;
    data?: any;
  };
  onRemove?: (id: string) => void;
  onSettings?: (id: string) => void;
}

const componentMap: Record<string, React.ComponentType<any>> = {
  LineChart,
  BarChart,
  PieChart,
  MetricsCard,
  CanvasEditor,
  ProductMetricsCard,
  DateRangeSelector,
};

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, onRemove, onSettings }) => {
  const removeWidget = useDashboardStore((state) => state.removeWidget);
  const Component = componentMap[widget.type];

  const handleRemove = () => {
    if (onRemove) {
      onRemove(widget.id);
    } else {
      removeWidget(widget.id);
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings(widget.id);
    }
  };

  if (!Component) {
    return (
      <WidgetContainer>
        <WidgetHeader>
          <Typography variant="body2">不明なウィジェット: {widget.type}</Typography>
        </WidgetHeader>
      </WidgetContainer>
    );
  }

  // 特別な処理が必要なコンポーネント
  const renderComponent = () => {
    switch (widget.type) {
      case 'CanvasEditor':
        return (
          <CanvasEditor
            width={600}
            height={400}
            backgroundColor="#ffffff"
          />
        );
      case 'ProductMetricsCard':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
            <ProductMetricsCard
              id="demo-1"
              productName="サンプル商品"
              sales={1500000}
              views={25000}
              orders={350}
            />
          </Box>
        );
      case 'DateRangeSelector':
        return (
          <Box sx={{ maxWidth: 400, mx: 'auto' }}>
            <DateRangeSelector onChange={(start, end) => console.log('日付範囲:', start, end)} />
          </Box>
        );
      case 'LineChart':
      case 'BarChart':
      case 'PieChart':
        return (
          <ResizableChart
            minWidth={600}
            minHeight={400}
            defaultWidth={800}
            defaultHeight={500}
          >
            <Component {...widget.data} />
          </ResizableChart>
        );
      default:
        return <Component {...widget.data} />;
    }
  };

  return (
    <WidgetContainer elevation={1}>
      <WidgetHeader>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {widget.title}
        </Typography>
        <Box>
          <IconButton size="small" onClick={handleSettings}>
            <Settings size={18} />
          </IconButton>
          <IconButton size="small" onClick={handleRemove}>
            <X size={18} />
          </IconButton>
        </Box>
      </WidgetHeader>
      <WidgetContent>
        {renderComponent()}
      </WidgetContent>
    </WidgetContainer>
  );
};

export default WidgetRenderer;