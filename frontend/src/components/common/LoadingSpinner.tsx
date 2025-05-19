import React from 'react';
import { Box, CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  size?: number;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 40, 
  fullPage = false 
}) => {
  if (fullPage) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={size} />
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      p={2}
    >
      <CircularProgress size={size} />
    </Box>
  );
};

export default LoadingSpinner;