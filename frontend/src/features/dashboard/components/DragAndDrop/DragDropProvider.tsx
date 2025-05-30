import React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Box, Paper } from '@mui/material';

interface DragDropProviderProps {
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動後にドラッグ開始
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    onDragStart?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    onDragEnd?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    onDragOver?.(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      {children}
      <DragOverlay>
        {activeId ? (
          <motion.div
            initial={{ scale: 1.05, opacity: 0.8 }}
            animate={{ scale: 1.1, opacity: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <Paper
              elevation={8}
              sx={{
                width: 200,
                height: 150,
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2) 0%, rgba(52, 211, 153, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                border: '2px solid #34D399',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grabbing',
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  fontSize: '48px',
                  color: '#34D399',
                  opacity: 0.8,
                }}
              >
                📊
              </Box>
            </Paper>
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};