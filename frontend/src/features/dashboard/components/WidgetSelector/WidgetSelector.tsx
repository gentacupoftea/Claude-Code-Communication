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
  IconButton,
  Box,
  Chip,
  TextField,
  InputAdornment,
  Fade,
  Zoom,
} from '@mui/material';
import { DraggableWidget } from '../DragAndDrop/DraggableWidget';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ShowChart,
  BarChart,
  PieChart,
  ScatterPlot,
  Speed,
  DataUsage,
  TableChart,
  Map,
  CalendarToday,
  Image,
  TextFields,
  Dashboard,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface WidgetSelectorProps {
  open: boolean;
  onClose: () => void;
  onAddWidget: (config: any) => void;
}

interface WidgetType {
  type: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  defaultSize: { w: number; h: number };
  color: string;
}

const widgetTypes: WidgetType[] = [
  {
    type: 'line-chart',
    name: '折れ線グラフ',
    description: '時系列データやトレンドの表示に最適',
    icon: ShowChart,
    category: 'chart',
    defaultSize: { w: 6, h: 4 },
    color: '#34D399',
  },
  {
    type: 'bar-chart',
    name: '棒グラフ',
    description: 'カテゴリ別の数値比較に使用',
    icon: BarChart,
    category: 'chart',
    defaultSize: { w: 6, h: 4 },
    color: '#60A5FA',
  },
  {
    type: 'pie-chart',
    name: '円グラフ',
    description: '全体に対する割合を可視化',
    icon: PieChart,
    category: 'chart',
    defaultSize: { w: 4, h: 4 },
    color: '#F472B6',
  },
  {
    type: 'scatter-chart',
    name: '散布図',
    description: '二つの変数の相関関係を表示',
    icon: ScatterPlot,
    category: 'chart',
    defaultSize: { w: 6, h: 4 },
    color: '#A78BFA',
  },
  {
    type: 'gauge',
    name: 'ゲージ',
    description: 'KPIや進捗をメーター表示',
    icon: Speed,
    category: 'metric',
    defaultSize: { w: 3, h: 3 },
    color: '#FBBF24',
  },
  {
    type: 'kpi-card',
    name: 'KPIカード',
    description: '重要指標を数値で強調表示',
    icon: DataUsage,
    category: 'metric',
    defaultSize: { w: 3, h: 2 },
    color: '#EF4444',
  },
  {
    type: 'data-table',
    name: 'データテーブル',
    description: '構造化データの詳細表示',
    icon: TableChart,
    category: 'data',
    defaultSize: { w: 8, h: 6 },
    color: '#10B981',
  },
  {
    type: 'map',
    name: '地図',
    description: '地理的データの可視化',
    icon: Map,
    category: 'data',
    defaultSize: { w: 6, h: 6 },
    color: '#06B6D4',
  },
  {
    type: 'calendar',
    name: 'カレンダー',
    description: 'スケジュールやイベントの表示',
    icon: CalendarToday,
    category: 'widget',
    defaultSize: { w: 6, h: 4 },
    color: '#8B5CF6',
  },
  {
    type: 'image',
    name: '画像',
    description: '静的画像やロゴの表示',
    icon: Image,
    category: 'widget',
    defaultSize: { w: 4, h: 3 },
    color: '#F59E0B',
  },
  {
    type: 'text',
    name: 'テキスト',
    description: '説明文やラベルの表示',
    icon: TextFields,
    category: 'widget',
    defaultSize: { w: 4, h: 2 },
    color: '#6B7280',
  },
];

const categories = [
  { key: 'all', name: 'すべて', color: '#34D399' },
  { key: 'chart', name: 'グラフ', color: '#60A5FA' },
  { key: 'metric', name: 'メトリクス', color: '#F472B6' },
  { key: 'data', name: 'データ', color: '#10B981' },
  { key: 'widget', name: 'ウィジェット', color: '#8B5CF6' },
];

export const WidgetSelector: React.FC<WidgetSelectorProps> = ({
  open,
  onClose,
  onAddWidget,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isDragging, setIsDragging] = useState(false);

  const filteredWidgets = widgetTypes.filter((widget) => {
    const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleWidgetSelect = (widget: WidgetType) => {
    const config = {
      type: widget.type,
      title: `新しい${widget.name}`,
      dataSource: {
        id: 'demo-data',
        type: 'api',
      },
      dimensions: ['category'],
      measures: [{ field: 'value', aggregation: 'sum' }],
      styling: { 
        theme: 'dark', 
        animation: true,
        color: widget.color,
      },
      interactions: { tooltip: true, legend: true },
      defaultSize: widget.defaultSize,
    };
    onAddWidget(config);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 300 }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          minHeight: '600px',
          opacity: isDragging ? 0.7 : 1,
          transition: 'opacity 0.3s ease',
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <Dashboard sx={{ mr: 2, color: '#34D399' }} />
            <Typography variant="h5" fontWeight="bold" color="#FFFFFF">
              ウィジェットを追加
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              color: '#9CA3AF',
              '&:hover': {
                color: '#34D399',
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* 検索とフィルタ */}
        <Box mb={3}>
          <TextField
            fullWidth
            placeholder="ウィジェットを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'rgba(52, 211, 153, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(52, 211, 153, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#34D399',
                },
              },
              '& .MuiInputBase-input': {
                color: '#FFFFFF',
              },
            }}
          />

          {/* カテゴリフィルタ */}
          <Box display="flex" gap={1} flexWrap="wrap">
            {categories.map((category) => (
              <Chip
                key={category.key}
                label={category.name}
                variant={selectedCategory === category.key ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory(category.key)}
                sx={{
                  color: selectedCategory === category.key ? '#000000' : category.color,
                  backgroundColor: selectedCategory === category.key ? category.color : 'transparent',
                  borderColor: category.color,
                  '&:hover': {
                    backgroundColor: `${category.color}20`,
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* ウィジェットグリッド */}
        <Grid container spacing={2}>
          {filteredWidgets.map((widget, index) => (
            <Grid item xs={12} sm={6} md={4} key={widget.type}>
              <Zoom
                in={true}
                timeout={300 + index * 50}
                style={{ transformOrigin: '0 0 0' }}
              >
                <Box
                  onClick={() => handleWidgetSelect(widget)}
                  sx={{ cursor: 'pointer' }}
                >
                  <DraggableWidget
                    id={`widget-selector-${widget.type}`}
                    type={widget.type}
                    name={widget.name}
                    icon={widget.icon}
                    color={widget.color}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                  />
                </Box>
              </Zoom>
            </Grid>
          ))}
        </Grid>

        {filteredWidgets.length === 0 && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={6}
          >
            <SearchIcon sx={{ fontSize: 64, color: '#6B7280', mb: 2 }} />
            <Typography variant="h6" color="#9CA3AF" gutterBottom>
              ウィジェットが見つかりません
            </Typography>
            <Typography variant="body2" color="#6B7280">
              検索条件を変更して再度お試しください
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};