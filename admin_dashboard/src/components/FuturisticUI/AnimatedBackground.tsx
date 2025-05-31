/**
 * Animated Background Component
 * パーティクルとグリッド効果を持つ動的背景
 */

import React from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  variant?: 'particles' | 'grid' | 'waves' | 'matrix';
  color?: string;
  opacity?: number;
  speed?: 'slow' | 'medium' | 'fast';
}

const BackgroundContainer = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
  zIndex: -1,
  pointerEvents: 'none',
});

const ParticlesCanvas = styled('canvas')({
  position: 'absolute',
  width: '100%',
  height: '100%',
});

const GridPattern = styled(Box)<{ color?: string }>(({ color = '#34d399' }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  backgroundImage: `
    linear-gradient(${color}22 1px, transparent 1px),
    linear-gradient(90deg, ${color}22 1px, transparent 1px)
  `,
  backgroundSize: '50px 50px',
  animation: 'gridMove 20s linear infinite',
  
  '@keyframes gridMove': {
    '0%': {
      transform: 'translate(0, 0)',
    },
    '100%': {
      transform: 'translate(50px, 50px)',
    },
  },
}));

const WavePattern = styled(Box)<{ color?: string }>(({ color = '#34d399' }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  background: `
    radial-gradient(ellipse at 50% 50%, transparent 0%, ${color}11 100%),
    radial-gradient(ellipse at 80% 80%, transparent 0%, ${color}11 100%),
    radial-gradient(ellipse at 20% 80%, transparent 0%, ${color}11 100%)
  `,
  animation: 'waveMove 20s ease-in-out infinite',
  
  '@keyframes waveMove': {
    '0%, 100%': {
      transform: 'scale(1) rotate(0deg)',
    },
    '50%': {
      transform: 'scale(1.1) rotate(180deg)',
    },
  },
}));

const MatrixRain = styled(Box)<{ color?: string }>(({ color = '#34d399' }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        ${color}22 2px,
        ${color}22 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        ${color}11 2px,
        ${color}11 4px
      )
    `,
    animation: 'matrixRain 20s linear infinite',
  },
  
  '@keyframes matrixRain': {
    '0%': {
      transform: 'translateY(-100%)',
    },
    '100%': {
      transform: 'translateY(100%)',
    },
  },
}));

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'particles',
  color = '#34d399',
  opacity = 0.5,
  speed = 'medium',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  React.useEffect(() => {
    if (variant !== 'particles' || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];
    
    const particleCount = 100;
    const speedMultiplier = speed === 'slow' ? 0.3 : speed === 'medium' ? 1 : 2;
    
    // パーティクルの初期化
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speedMultiplier,
        vy: (Math.random() - 0.5) * speedMultiplier,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.3,
      });
    }
    
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // パーティクルの描画と更新
      particles.forEach((particle, index) => {
        // 他のパーティクルとの接続線を描画
        particles.forEach((otherParticle, otherIndex) => {
          if (index !== otherIndex) {
            const distance = Math.sqrt(
              Math.pow(particle.x - otherParticle.x, 2) +
              Math.pow(particle.y - otherParticle.y, 2)
            );
            
            if (distance < 150) {
              ctx.beginPath();
              ctx.strokeStyle = color + Math.floor((1 - distance / 150) * 255).toString(16).padStart(2, '0');
              ctx.lineWidth = 0.5;
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.stroke();
            }
          }
        });
        
        // パーティクルを描画
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(particle.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
        
        // パーティクルの位置を更新
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // 画面端での反射
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [variant, color, speed]);
  
  return (
    <BackgroundContainer sx={{ opacity }}>
      {variant === 'particles' && <ParticlesCanvas ref={canvasRef} />}
      {variant === 'grid' && <GridPattern color={color} />}
      {variant === 'waves' && <WavePattern color={color} />}
      {variant === 'matrix' && <MatrixRain color={color} />}
      
      {/* グラデーションオーバーレイ */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse at 20% 30%, ${color}22 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, ${color}22 0%, transparent 50%)
          `,
        }}
      />
    </BackgroundContainer>
  );
};

export default AnimatedBackground;
