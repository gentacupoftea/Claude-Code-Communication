import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`;

const StyledButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
  color: '#FFFFFF',
  borderRadius: 8,
  padding: '10px 24px',
  fontWeight: 600,
  textTransform: 'none',
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
    animation: `${shimmer} 2s infinite`,
  },
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}));

export const FuturisticButton: React.FC<ButtonProps> = (props) => {
  return <StyledButton {...props} />;
};

export default FuturisticButton;