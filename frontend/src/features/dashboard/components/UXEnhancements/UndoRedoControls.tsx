import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import {
  Undo as UndoIcon,
  Redo as RedoIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoActionName?: string | null;
  redoActionName?: string | null;
  historySize?: number;
  isVisible?: boolean;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoActionName,
  redoActionName,
  historySize = 0,
  isVisible = true,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Paper
          sx={{
            position: 'fixed',
            top: 80,
            left: 16,
            zIndex: 1100,
            background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {/* Undo ボタン */}
          <Tooltip 
            title={undoActionName ? `元に戻す: ${undoActionName}` : '元に戻す (Ctrl+Z)'}
            placement="bottom"
          >
            <span>
              <IconButton
                onClick={onUndo}
                disabled={!canUndo}
                sx={{
                  color: canUndo ? '#34D399' : '#6B7280',
                  backgroundColor: canUndo ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: canUndo ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                    transform: canUndo ? 'scale(1.1)' : 'none',
                  },
                  '&:disabled': {
                    color: '#6B7280',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Redo ボタン */}
          <Tooltip 
            title={redoActionName ? `やり直し: ${redoActionName}` : 'やり直し (Ctrl+Y)'}
            placement="bottom"
          >
            <span>
              <IconButton
                onClick={onRedo}
                disabled={!canRedo}
                sx={{
                  color: canRedo ? '#60A5FA' : '#6B7280',
                  backgroundColor: canRedo ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: canRedo ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                    transform: canRedo ? 'scale(1.1)' : 'none',
                  },
                  '&:disabled': {
                    color: '#6B7280',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* 履歴サイズ表示 */}
          <Box display="flex" alignItems="center" px={1}>
            <HistoryIcon sx={{ fontSize: 16, color: '#9CA3AF', mr: 0.5 }} />
            <Typography variant="caption" color="#9CA3AF">
              {historySize}
            </Typography>
          </Box>
        </Paper>
      </motion.div>
    </AnimatePresence>
  );
};