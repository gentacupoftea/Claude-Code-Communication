import React from 'react';
import { Typography, Box } from '@mui/material';

const Logs: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        ログ・監視
      </Typography>
      <Typography variant="body1" color="text.secondary">
        ログ・監視ページは現在開発中です。
      </Typography>
    </Box>
  );
};

export default Logs;