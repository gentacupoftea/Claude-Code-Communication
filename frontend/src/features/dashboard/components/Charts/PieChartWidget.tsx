import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface PieChartWidgetProps {
  widget: Widget;
}

export const PieChartWidget: React.FC<PieChartWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Pie Chart - {widget.config.title}</Typography>
    </Box>
  );
};