import React from 'react';
import { Typography, Box } from '@mui/material';

const Memory: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        メモリ同期
      </Typography>
      <Typography variant="body1" color="text.secondary">
        メモリ同期ページは現在開発中です。
      </Typography>
    </Box>
  );
};

export default Memory;