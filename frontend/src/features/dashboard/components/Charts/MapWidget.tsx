import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface MapWidgetProps {
  widget: Widget;
}

export const MapWidget: React.FC<MapWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Map - {widget.config.title}</Typography>
    </Box>
  );
};