/**
 * Glass Container Component
 * グラスモーフィズム効果を持つコンテナ
 */

import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface GlassContainerProps extends BoxProps {
  blur?: 'light' | 'medium' | 'heavy';
  gradient?: boolean;
  borderGlow?: boolean;
}

const StyledGlassBox = styled(Box)<GlassContainerProps>(({ theme, blur = 'medium', gradient, borderGlow }) => {
  const blurAmount = blur === 'light' ? '10px' : blur === 'medium' ? '20px' : '30px';
  
  return {
    position: 'relative',
    background: gradient
      ? `linear-gradient(135deg, 
          rgba(52, 211, 153, 0.1) 0%, 
          rgba(0, 212, 255, 0.1) 50%, 
          rgba(168, 85, 247, 0.1) 100%)`
      : 'rgba(255, 255, 255, 0.05)',
    backdropFilter: `blur(${blurAmount})`,
    WebkitBackdropFilter: `blur(${blurAmount})`,
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: theme.spacing(3),
    overflow: 'hidden',
    
    // 内側の光沢効果
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 0%, transparent 100%)',
      pointerEvents: 'none',
    },
    
    // ボーダーグロー効果
    ...(borderGlow && {
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -1,
        left: -1,
        right: -1,
        bottom: -1,
        background: `linear-gradient(45deg, 
          ${theme.palette.primary.main} 0%, 
          ${theme.palette.secondary.main} 50%, 
          ${theme.palette.primary.main} 100%)`,
        borderRadius: '20px',
        backgroundSize: '300% 300%',
        animation: 'borderGlow 4s ease infinite',
        zIndex: -1,
        opacity: 0.7,
      },
      
      '@keyframes borderGlow': {
        '0%, 100%': {
          backgroundPosition: '0% 50%',
        },
        '50%': {
          backgroundPosition: '100% 50%',
        },
      },
    }),
    
    // 微細なノイズテクスチャ
    '&::after': borderGlow ? undefined : {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.03,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
      pointerEvents: 'none',
    },
  };
});

const FloatingParticle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: '4px',
  height: '4px',
  background: theme.palette.primary.main,
  borderRadius: '50%',
  opacity: 0.6,
  animation: 'floatUp 10s linear infinite',
  
  '@keyframes floatUp': {
    '0%': {
      transform: 'translateY(100vh) translateX(0)',
      opacity: 0,
    },
    '10%': {
      opacity: 0.6,
    },
    '90%': {
      opacity: 0.6,
    },
    '100%': {
      transform: 'translateY(-100vh) translateX(100px)',
      opacity: 0,
    },
  },
}));

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  blur = 'medium',
  gradient = false,
  borderGlow = false,
  ...props
}) => {
  const particles = React.useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 10}s`,
      animationDuration: `${10 + Math.random() * 10}s`,
    }));
  }, []);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <StyledGlassBox
        blur={blur}
        gradient={gradient}
        borderGlow={borderGlow}
        {...props}
      >
        {particles.map((particle) => (
          <FloatingParticle
            key={particle.id}
            sx={{
              left: particle.left,
              animationDelay: particle.animationDelay,
              animationDuration: particle.animationDuration,
            }}
          />
        ))}
        {children}
      </StyledGlassBox>
    </motion.div>
  );
};

export default GlassContainer;
