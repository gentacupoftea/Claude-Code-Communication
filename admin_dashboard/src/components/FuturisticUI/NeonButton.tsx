/**
 * Neon Button Component
 * ネオン効果とアニメーションを持つボタン
 */

import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface NeonButtonProps extends ButtonProps {
  neonColor?: string;
  pulseAnimation?: boolean;
  rippleEffect?: boolean;
}

const StyledButton = styled(Button)<NeonButtonProps>(({ theme, neonColor, pulseAnimation }) => {
  const color = neonColor || theme.palette.primary.main;
  
  return {
    position: 'relative',
    overflow: 'hidden',
    background: 'transparent',
    color: color,
    border: `2px solid ${color}`,
    borderRadius: '12px',
    padding: '12px 32px',
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    isolation: 'isolate',
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: color,
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },
    
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '0',
      height: '0',
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      transform: 'translate(-50%, -50%)',
      transition: 'width 0.6s ease, height 0.6s ease',
      zIndex: -1,
    },
    
    // ネオングロー効果
    boxShadow: `
      0 0 5px ${color},
      0 0 10px ${color},
      0 0 20px ${color},
      inset 0 0 5px ${color}
    `,
    
    // ホバー効果
    '&:hover': {
      color: theme.palette.background.paper,
      borderColor: color,
      transform: 'translateY(-2px)',
      boxShadow: `
        0 0 10px ${color},
        0 0 20px ${color},
        0 0 40px ${color},
        0 0 80px ${color},
        inset 0 0 10px ${color}
      `,
      
      '&::before': {
        opacity: 1,
      },
      
      '&::after': {
        width: '300%',
        height: '300%',
      },
    },
    
    // アクティブ効果
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: `
        0 0 5px ${color},
        0 0 10px ${color},
        inset 0 0 20px ${color}
      `,
    },
    
    // パルスアニメーション
    ...(pulseAnimation && {
      animation: 'neonPulse 2s infinite',
      '@keyframes neonPulse': {
        '0%, 100%': {
          boxShadow: `
            0 0 5px ${color},
            0 0 10px ${color},
            0 0 20px ${color},
            inset 0 0 5px ${color}
          `,
        },
        '50%': {
          boxShadow: `
            0 0 10px ${color},
            0 0 30px ${color},
            0 0 50px ${color},
            inset 0 0 10px ${color}
          `,
        },
      },
    }),
    
    // 無効状態
    '&.Mui-disabled': {
      opacity: 0.3,
      boxShadow: 'none',
      animation: 'none',
    },
  };
});

const RippleEffect = styled('span')({
  position: 'absolute',
  borderRadius: '50%',
  transform: 'scale(0)',
  animation: 'ripple 0.6s linear',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  
  '@keyframes ripple': {
    to: {
      transform: 'scale(4)',
      opacity: 0,
    },
  },
});

export const NeonButton: React.FC<NeonButtonProps> = ({
  children,
  neonColor,
  pulseAnimation = false,
  rippleEffect = true,
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; size: number }>>([]);
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (rippleEffect) {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      
      const newRipple = { x, y, size };
      setRipples((prevRipples) => [...prevRipples, newRipple]);
      
      setTimeout(() => {
        setRipples((prevRipples) => prevRipples.slice(1));
      }, 600);
    }
    
    if (onClick) {
      onClick(event);
    }
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <StyledButton
        neonColor={neonColor}
        pulseAnimation={pulseAnimation}
        onClick={handleClick}
        {...props}
      >
        {ripples.map((ripple, index) => (
          <RippleEffect
            key={index}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
        {children}
      </StyledButton>
    </motion.div>
  );
};

export default NeonButton;
