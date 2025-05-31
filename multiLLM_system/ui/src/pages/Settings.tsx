import React from 'react';
import { Typography, Box } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>
      <Typography variant="body1" color="text.secondary">
        設定ページは現在開発中です。
      </Typography>
    </Box>
  );
};

export default Settings;