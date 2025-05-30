/**
 * Cyber Grid Component
 * サイバーパンク風のグリッドレイアウト
 */

import React from 'react';
import { Grid, GridProps, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface CyberGridProps extends GridProps {
  showLines?: boolean;
  animateLines?: boolean;
  glowIntensity?: 'low' | 'medium' | 'high';
}

const StyledGrid = styled(Grid)<CyberGridProps>(({ theme, showLines, animateLines, glowIntensity = 'medium' }) => ({
  position: 'relative',
  
  ...(showLines && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `
        linear-gradient(to right, ${theme.palette.primary.main}22 1px, transparent 1px),
        linear-gradient(to bottom, ${theme.palette.primary.main}22 1px, transparent 1px)
      `,
      backgroundSize: '20px 20px',
      pointerEvents: 'none',
      opacity: glowIntensity === 'low' ? 0.3 : glowIntensity === 'medium' ? 0.5 : 0.7,
      
      ...(animateLines && {
        animation: 'gridPulse 4s ease-in-out infinite',
      }),
    },
    
    '@keyframes gridPulse': {
      '0%, 100%': {
        opacity: glowIntensity === 'low' ? 0.3 : glowIntensity === 'medium' ? 0.5 : 0.7,
      },
      '50%': {
        opacity: 1,
      },
    },
  }),
}));

const GridNode = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: '6px',
  height: '6px',
  background: theme.palette.primary.main,
  borderRadius: '50%',
  boxShadow: `0 0 10px ${theme.palette.primary.main}`,
  animation: 'nodePulse 2s ease-in-out infinite',
  
  '@keyframes nodePulse': {
    '0%, 100%': {
      transform: 'scale(1)',
      opacity: 0.8,
    },
    '50%': {
      transform: 'scale(1.5)',
      opacity: 1,
    },
  },
}));

const DataLine = styled(Box)<{ direction: 'horizontal' | 'vertical' }>(({ theme, direction }) => ({
  position: 'absolute',
  background: `linear-gradient(${direction === 'horizontal' ? 'to right' : 'to bottom'}, 
    transparent 0%, 
    ${theme.palette.primary.main} 50%, 
    transparent 100%)`,
  width: direction === 'horizontal' ? '100px' : '2px',
  height: direction === 'horizontal' ? '2px' : '100px',
  animation: direction === 'horizontal' ? 'moveHorizontal 3s linear infinite' : 'moveVertical 3s linear infinite',
  
  '@keyframes moveHorizontal': {
    '0%': {
      transform: 'translateX(-100px)',
    },
    '100%': {
      transform: 'translateX(100vw)',
    },
  },
  
  '@keyframes moveVertical': {
    '0%': {
      transform: 'translateY(-100px)',
    },
    '100%': {
      transform: 'translateY(100vh)',
    },
  },
}));

export const CyberGrid: React.FC<CyberGridProps> = ({
  children,
  showLines = true,
  animateLines = true,
  glowIntensity = 'medium',
  ...props
}) => {
  const nodes = React.useMemo(() => {
    const nodePositions = [];
    for (let i = 0; i < 5; i++) {
      nodePositions.push({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 2}s`,
      });
    }
    return nodePositions;
  }, []);
  
  const dataLines = React.useMemo(() => {
    const lines = [];
    for (let i = 0; i < 3; i++) {
      lines.push({
        id: i,
        direction: i % 2 === 0 ? 'horizontal' : 'vertical' as 'horizontal' | 'vertical',
        position: Math.random() * 100,
        animationDelay: `${Math.random() * 3}s`,
      });
    }
    return lines;
  }, []);
  
  return (
    <StyledGrid
      showLines={showLines}
      animateLines={animateLines}
      glowIntensity={glowIntensity}
      {...props}
    >
      {/* グリッドノード */}
      {showLines && nodes.map((node) => (
        <GridNode
          key={node.id}
          sx={{
            top: node.top,
            left: node.left,
            animationDelay: node.animationDelay,
          }}
        />
      ))}
      
      {/* データライン */}
      {animateLines && dataLines.map((line) => (
        <DataLine
          key={line.id}
          direction={line.direction}
          sx={{
            ...(line.direction === 'horizontal'
              ? { top: `${line.position}%`, left: 0 }
              : { left: `${line.position}%`, top: 0 }),
            animationDelay: line.animationDelay,
          }}
        />
      ))}
      
      {/* コンテンツ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ width: '100%' }}
      >
        {children}
      </motion.div>
    </StyledGrid>
  );
};

export default CyberGrid;
