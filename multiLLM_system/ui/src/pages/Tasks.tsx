import React from 'react';
import { Typography, Box } from '@mui/material';

const Tasks: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        タスク管理
      </Typography>
      <Typography variant="body1" color="text.secondary">
        タスク管理ページは現在開発中です。
      </Typography>
    </Box>
  );
};

export default Tasks;