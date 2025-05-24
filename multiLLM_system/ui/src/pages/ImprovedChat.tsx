import React from 'react';
import { Box } from '@mui/material';
import { ImprovedChatInterface } from '../components/ImprovedChat';

const ImprovedChat: React.FC = () => {
  return (
    <Box sx={{ height: '100vh', overflow: 'hidden' }}>
      <ImprovedChatInterface />
    </Box>
  );
};

export default ImprovedChat;