import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface ScatterChartWidgetProps {
  widget: Widget;
}

export const ScatterChartWidget: React.FC<ScatterChartWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Scatter Chart - {widget.config.title}</Typography>
    </Box>
  );
};