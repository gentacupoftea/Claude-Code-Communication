import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { Dashboard as DashboardIcon } from '@mui/icons-material';

interface DropZoneProps {
  id: string;
  children?: React.ReactNode;
  isEmpty?: boolean;
  isOver?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  children,
  isEmpty = false,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        minHeight: isEmpty ? '400px' : 'auto',
        width: '100%',
        border: `2px dashed ${isOver ? '#34D399' : 'rgba(255, 255, 255, 0.2)'}`,
        borderRadius: 2,
        backgroundColor: isOver 
          ? 'rgba(52, 211, 153, 0.1)' 
          : isEmpty 
            ? 'rgba(255, 255, 255, 0.02)' 
            : 'transparent',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ 
            opacity: isOver ? 1 : 0.6,
            scale: isOver ? 1.05 : 1,
          }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <DashboardIcon
            sx={{
              fontSize: 80,
              color: isOver ? '#34D399' : '#6B7280',
              mb: 2,
            }}
          />
          <Typography
            variant="h6"
            color={isOver ? '#34D399' : '#9CA3AF'}
            gutterBottom
            fontWeight="bold"
          >
            {isOver ? 'ここにドロップしてください' : 'ウィジェットをドラッグしてください'}
          </Typography>
          <Typography
            variant="body2"
            color="#6B7280"
            textAlign="center"
            sx={{ maxWidth: '300px' }}
          >
            {isOver 
              ? 'ウィジェットがダッシュボードに追加されます'
              : 'ウィジェットライブラリからお好みのウィジェットを選択してドラッグしてください'
            }
          </Typography>
        </motion.div>
      )}
      
      {isOver && !isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(52, 211, 153, 0.1)',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      
      {children}
    </Box>
  );
};