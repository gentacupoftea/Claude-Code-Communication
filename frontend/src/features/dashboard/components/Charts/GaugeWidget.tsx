import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface GaugeWidgetProps {
  widget: Widget;
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Gauge - {widget.config.title}</Typography>
    </Box>
  );
};