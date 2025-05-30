'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { X, BarChart, LineChart, PieChart, TrendingUp, Calendar, Palette, Package } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '16px',
    maxWidth: '800px',
    width: '100%',
  },
}));

const WidgetCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  border: '2px solid transparent',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    borderColor: '#34d399',
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: '60px',
  height: '60px',
  borderRadius: '12px',
  backgroundColor: '#e8f5e9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '16px',
  color: '#34d399',
}));

interface WidgetOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'chart' | 'custom' | 'filter';
  component: string;
}

const widgetOptions: WidgetOption[] = [
  {
    id: 'line-chart',
    name: '折れ線グラフ',
    description: '時系列データの推移を表示',
    icon: <LineChart size={28} />,
    category: 'chart',
    component: 'LineChart',
  },
  {
    id: 'bar-chart',
    name: '棒グラフ',
    description: 'カテゴリ別の比較を表示',
    icon: <BarChart size={28} />,
    category: 'chart',
    component: 'BarChart',
  },
  {
    id: 'pie-chart',
    name: '円グラフ',
    description: '構成比を視覚的に表示',
    icon: <PieChart size={28} />,
    category: 'chart',
    component: 'PieChart',
  },
  {
    id: 'metrics-card',
    name: 'メトリクスカード',
    description: 'KPIを数値で表示',
    icon: <TrendingUp size={28} />,
    category: 'chart',
    component: 'MetricsCard',
  },
  {
    id: 'canvas-editor',
    name: 'キャンバスエディター',
    description: '自由にテキストや図形を配置',
    icon: <Palette size={28} />,
    category: 'custom',
    component: 'CanvasEditor',
  },
  {
    id: 'product-metrics',
    name: '商品メトリクス',
    description: '商品別の売上・アクセス数を表示',
    icon: <Package size={28} />,
    category: 'custom',
    component: 'ProductMetricsCard',
  },
  {
    id: 'date-range',
    name: '日付範囲フィルター',
    description: 'データの表示期間を選択',
    icon: <Calendar size={28} />,
    category: 'filter',
    component: 'DateRangeSelector',
  },
];

interface WidgetSelectorProps {
  open: boolean;
  onClose: () => void;
}

export const WidgetSelector: React.FC<WidgetSelectorProps> = ({ open, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'chart' | 'custom' | 'filter'>('all');
  const addWidget = useDashboardStore((state) => state.addWidget);

  const filteredWidgets = selectedCategory === 'all' 
    ? widgetOptions 
    : widgetOptions.filter(w => w.category === selectedCategory);

  const handleWidgetSelect = (widget: WidgetOption) => {
    const newWidget = {
      id: `${widget.id}-${Date.now()}`,
      type: widget.component,
      title: widget.name,
      data: {},
      layout: { x: 0, y: 0, w: 4, h: 3 },
    };
    
    addWidget(newWidget);
    onClose();
  };

  const categoryLabels = {
    all: 'すべて',
    chart: 'グラフ',
    custom: 'カスタム',
    filter: 'フィルター',
  };

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
            コンポーネントを追加
          </Typography>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Box>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              onClick={() => setSelectedCategory(key as any)}
              sx={{
                backgroundColor: selectedCategory === key ? '#34d399' : '#f5f5f5',
                color: selectedCategory === key ? 'white' : '#666',
                '&:hover': {
                  backgroundColor: selectedCategory === key ? '#2fb383' : '#e0e0e0',
                },
              }}
            />
          ))}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          {filteredWidgets.map((widget) => (
            <Grid item xs={12} sm={6} md={4} key={widget.id}>
              <WidgetCard>
                <CardActionArea onClick={() => handleWidgetSelect(widget)} sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <IconWrapper>
                      {widget.icon}
                    </IconWrapper>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {widget.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {widget.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </WidgetCard>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </StyledDialog>
  );
};

export default WidgetSelector;