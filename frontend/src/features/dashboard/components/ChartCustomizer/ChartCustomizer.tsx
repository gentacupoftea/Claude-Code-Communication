import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ChartCustomizerProps {
  widgetId: string;
  onClose: () => void;
}

export const ChartCustomizer: React.FC<ChartCustomizerProps> = ({ widgetId, onClose }) => {
  return (
    <Box sx={{ p: 2, width: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">チャート設定</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Typography variant="body2" color="textSecondary">
        Widget ID: {widgetId}
      </Typography>
      <Typography variant="body2" sx={{ mt: 2 }}>
        チャートのカスタマイズ機能は現在開発中です。
      </Typography>
    </Box>
  );
};