/**
 * Settings Page - 設定ページ
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

const SettingsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Application settings coming soon...
      </Typography>
    </Box>
  );
};

export default SettingsPage;