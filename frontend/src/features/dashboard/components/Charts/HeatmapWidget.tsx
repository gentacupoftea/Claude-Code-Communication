import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface HeatmapWidgetProps {
  widget: Widget;
}

export const HeatmapWidget: React.FC<HeatmapWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Heatmap - {widget.config.title}</Typography>
    </Box>
  );
};