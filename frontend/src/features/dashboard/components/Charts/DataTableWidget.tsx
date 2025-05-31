import React from 'react';
import { Widget } from '../../types';
import { Box, Typography } from '@mui/material';

interface DataTableWidgetProps {
  widget: Widget;
}

export const DataTableWidget: React.FC<DataTableWidgetProps> = ({ widget }) => {
  return (
    <Box p={2} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography>Data Table - {widget.config.title}</Typography>
    </Box>
  );
};