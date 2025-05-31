import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface GridGuideLinesProps {
  isVisible: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  containerWidth?: number;
  containerHeight?: number;
  cols?: number;
  rowHeight?: number;
}

export const GridGuideLines: React.FC<GridGuideLinesProps> = ({
  isVisible,
  gridSize = 20,
  snapToGrid = true,
  containerWidth = 1200,
  containerHeight = 800,
  cols = 12,
  rowHeight = 60,
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showMouseGuides, setShowMouseGuides] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setShowMouseGuides(true);
      
      // マウスが動かなくなったら3秒後にガイドラインを非表示
      clearTimeout((window as any).mouseGuideTimeout);
      (window as any).mouseGuideTimeout = setTimeout(() => {
        setShowMouseGuides(false);
      }, 3000);
    };

    const handleMouseLeave = () => {
      setShowMouseGuides(false);
    };

    if (isVisible) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout((window as any).mouseGuideTimeout);
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const columnWidth = containerWidth / cols;
  const verticalLines = Array.from({ length: cols + 1 }, (_, i) => i * columnWidth);
  const horizontalLines = Array.from({ length: Math.ceil(containerHeight / rowHeight) + 1 }, (_, i) => i * rowHeight);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 999,
        }}
      >
        {/* グリッドライン */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0.3,
          }}
        >
          {/* 垂直線 */}
          {verticalLines.map((x, index) => (
            <Box
              key={`vertical-${index}`}
              sx={{
                position: 'absolute',
                left: x,
                top: 0,
                width: '1px',
                height: '100vh',
                background: index % 4 === 0 
                  ? 'linear-gradient(to bottom, #34D399, transparent)'
                  : 'linear-gradient(to bottom, rgba(52, 211, 153, 0.3), transparent)',
                backgroundSize: '1px 40px',
                backgroundRepeat: 'repeat-y',
              }}
            />
          ))}

          {/* 水平線 */}
          {horizontalLines.map((y, index) => (
            <Box
              key={`horizontal-${index}`}
              sx={{
                position: 'absolute',
                top: y,
                left: 0,
                width: '100vw',
                height: '1px',
                background: index % 4 === 0 
                  ? 'linear-gradient(to right, #34D399, transparent)'
                  : 'linear-gradient(to right, rgba(52, 211, 153, 0.3), transparent)',
                backgroundSize: '40px 1px',
                backgroundRepeat: 'repeat-x',
              }}
            />
          ))}
        </Box>

        {/* マウス位置のガイドライン */}
        <AnimatePresence>
          {showMouseGuides && snapToGrid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* 垂直ガイドライン */}
              <Box
                sx={{
                  position: 'fixed',
                  left: Math.round(mousePosition.x / gridSize) * gridSize,
                  top: 0,
                  width: '2px',
                  height: '100vh',
                  background: 'linear-gradient(to bottom, #F472B6, transparent)',
                  boxShadow: '0 0 10px #F472B6',
                  opacity: 0.8,
                }}
              />

              {/* 水平ガイドライン */}
              <Box
                sx={{
                  position: 'fixed',
                  top: Math.round(mousePosition.y / gridSize) * gridSize,
                  left: 0,
                  width: '100vw',
                  height: '2px',
                  background: 'linear-gradient(to right, #F472B6, transparent)',
                  boxShadow: '0 0 10px #F472B6',
                  opacity: 0.8,
                }}
              />

              {/* 交差点のドット */}
              <Box
                sx={{
                  position: 'fixed',
                  left: Math.round(mousePosition.x / gridSize) * gridSize - 4,
                  top: Math.round(mousePosition.y / gridSize) * gridSize - 4,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#F472B6',
                  boxShadow: '0 0 15px #F472B6',
                  border: '2px solid #FFFFFF',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* グリッド情報表示 */}
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '20px',
            px: 3,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: '#9CA3AF',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          <span>グリッド: {cols}列</span>
          <span>•</span>
          <span>行高: {rowHeight}px</span>
          <span>•</span>
          <span>スナップ: {snapToGrid ? 'ON' : 'OFF'}</span>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
};