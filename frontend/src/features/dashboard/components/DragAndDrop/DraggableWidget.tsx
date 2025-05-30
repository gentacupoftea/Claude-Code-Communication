import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { motion } from 'framer-motion';

interface DraggableWidgetProps {
  id: string;
  type: string;
  name: string;
  icon: React.ElementType;
  color: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  id,
  type,
  name,
  icon: Icon,
  color,
  onDragStart,
  onDragEnd,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: {
      type,
      name,
      color,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  React.useEffect(() => {
    if (isDragging) {
      onDragStart?.();
    } else {
      onDragEnd?.();
    }
  }, [isDragging, onDragStart, onDragEnd]);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Card
        sx={{
          background: isDragging 
            ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isDragging ? color : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: 2,
          height: '120px',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: 'all 0.3s ease',
          opacity: isDragging ? 0.5 : 1,
          transform: isDragging ? 'rotate(3deg)' : 'rotate(0deg)',
          '&:hover': {
            borderColor: color,
            boxShadow: `0 8px 32px ${color}40`,
            transform: 'translateY(-4px)',
          },
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            p: 2,
            '&:last-child': { pb: 2 },
          }}
        >
          <Icon
            sx={{
              fontSize: 40,
              color: color,
              mb: 1,
            }}
          />
          <Typography
            variant="body2"
            fontWeight="bold"
            color="#FFFFFF"
            textAlign="center"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {name}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};