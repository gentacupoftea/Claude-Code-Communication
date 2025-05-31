/**
 * Futuristic Card Component
 * 3D効果とホログラフィックなカード
 */

import React from 'react';
import { Card, CardProps, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface FuturisticCardProps extends CardProps {
  glowColor?: string;
  holographic?: boolean;
  depth?: 'low' | 'medium' | 'high';
}

const StyledCard = styled(Card)<FuturisticCardProps>(({ theme, glowColor, holographic, depth = 'medium' }) => ({
  position: 'relative',
  background: 'rgba(20, 20, 20, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(52, 211, 153, 0.2)',
  borderRadius: '24px',
  overflow: 'visible',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  transformStyle: 'preserve-3d',
  
  // 深度に応じた影
  boxShadow: depth === 'low' 
    ? '0 4px 20px rgba(52, 211, 153, 0.1)'
    : depth === 'medium'
    ? '0 8px 40px rgba(52, 211, 153, 0.2)'
    : '0 16px 60px rgba(52, 211, 153, 0.3)',

  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '24px',
    padding: '2px',
    background: holographic
      ? `linear-gradient(
          45deg,
          rgba(255, 0, 255, 0.3) 0%,
          rgba(0, 255, 255, 0.3) 25%,
          rgba(255, 255, 0, 0.3) 50%,
          rgba(255, 0, 255, 0.3) 75%,
          rgba(0, 255, 255, 0.3) 100%
        )`
      : `linear-gradient(135deg, ${glowColor || theme.palette.primary.main} 0%, transparent 100%)`,
    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'exclude',
    maskComposite: 'exclude',
    opacity: holographic ? 1 : 0.6,
    backgroundSize: holographic ? '300% 300%' : '100% 100%',
    animation: holographic ? 'holographicShift 8s ease infinite' : 'none',
  },

  '&::after': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: `radial-gradient(circle, ${glowColor || theme.palette.primary.main} 0%, transparent 70%)`,
    opacity: 0,
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  },

  '&:hover': {
    transform: 'translateY(-8px) rotateX(2deg)',
    boxShadow: depth === 'low'
      ? '0 12px 30px rgba(52, 211, 153, 0.3)'
      : depth === 'medium'
      ? '0 16px 50px rgba(52, 211, 153, 0.4)'
      : '0 24px 80px rgba(52, 211, 153, 0.5)',
    
    '&::after': {
      opacity: 0.1,
    },
  },

  '@keyframes holographicShift': {
    '0%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' },
  },
}));

const FloatingLight = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: '100px',
  height: '100px',
  borderRadius: '50%',
  background: `radial-gradient(circle, ${theme.palette.primary.main} 0%, transparent 70%)`,
  filter: 'blur(40px)',
  opacity: 0.4,
  pointerEvents: 'none',
  animation: 'float 6s ease-in-out infinite',
  
  '@keyframes float': {
    '0%, 100%': {
      transform: 'translate(0, 0)',
    },
    '33%': {
      transform: 'translate(30px, -30px)',
    },
    '66%': {
      transform: 'translate(-20px, 20px)',
    },
  },
}));

export const FuturisticCard: React.FC<FuturisticCardProps> = ({ 
  children, 
  glowColor,
  holographic = false,
  depth = 'medium',
  ...props 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <StyledCard 
        glowColor={glowColor} 
        holographic={holographic}
        depth={depth}
        elevation={0} 
        {...props}
      >
        {holographic && (
          <>
            <FloatingLight sx={{ top: -20, right: -20 }} />
            <FloatingLight sx={{ bottom: -30, left: -30, animationDelay: '3s' }} />
          </>
        )}
        {children}
      </StyledCard>
    </motion.div>
  );
};

export default FuturisticCard;
