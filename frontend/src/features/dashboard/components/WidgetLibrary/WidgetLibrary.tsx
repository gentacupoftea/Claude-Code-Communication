import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import {
  ShowChart,
  BarChart,
  PieChart,
  ScatterPlot,
  Speed,
  DataUsage,
  TableChart,
  Map,
} from '@mui/icons-material';

interface WidgetLibraryProps {
  onAddWidget: (config: any) => void;
}

const widgetTypes = [
  { type: 'line-chart', name: '折れ線グラフ', icon: ShowChart },
  { type: 'bar-chart', name: '棒グラフ', icon: BarChart },
  { type: 'pie-chart', name: '円グラフ', icon: PieChart },
  { type: 'scatter-chart', name: '散布図', icon: ScatterPlot },
  { type: 'gauge', name: 'ゲージ', icon: Speed },
  { type: 'kpi-card', name: 'KPIカード', icon: DataUsage },
  { type: 'data-table', name: 'データテーブル', icon: TableChart },
  { type: 'map', name: '地図', icon: Map },
];

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({ onAddWidget }) => {
  const handleWidgetSelect = (type: string) => {
    const config = {
      type,
      title: `新しい${widgetTypes.find(w => w.type === type)?.name}`,
      dataSource: {
        id: 'demo-data',
        type: 'api',
      },
      dimensions: ['category'],
      measures: [{ field: 'value', aggregation: 'sum' }],
      styling: { theme: 'light', animation: true },
      interactions: { tooltip: true, legend: true },
    };
    onAddWidget(config);
  };

  return (
    <Box sx={{ width: 300, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        ウィジェットライブラリ
      </Typography>
      <List>
        {widgetTypes.map((widget) => {
          const Icon = widget.icon;
          return (
            <ListItem
              key={widget.type}
              button
              onClick={() => handleWidgetSelect(widget.type)}
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={widget.name} />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};