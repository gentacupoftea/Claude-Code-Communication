import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface AutoSaveIndicatorProps {
  isAutosaving?: boolean;
  lastSaved?: Date | null;
  error?: Error | null;
  isVisible?: boolean;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  isAutosaving = false,
  lastSaved = null,
  error = null,
  isVisible = true,
}) => {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'saving' | 'saved' | 'error'>('saved');

  useEffect(() => {
    // 自動保存イベントリスナー
    const handleAutoSaveSuccess = () => {
      setNotificationType('saved');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    };

    const handleAutoSaveError = () => {
      setNotificationType('error');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    };

    window.addEventListener('autosave-success', handleAutoSaveSuccess);
    window.addEventListener('autosave-error', handleAutoSaveError);

    return () => {
      window.removeEventListener('autosave-success', handleAutoSaveSuccess);
      window.removeEventListener('autosave-error', handleAutoSaveError);
    };
  }, []);

  useEffect(() => {
    if (isAutosaving) {
      setNotificationType('saving');
      setShowNotification(true);
    }
  }, [isAutosaving]);

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // 1分未満
      return '今保存されました';
    } else if (diff < 3600000) { // 1時間未満
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分前に保存`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  const getIndicatorContent = () => {
    switch (notificationType) {
      case 'saving':
        return {
          icon: <CircularProgress size={16} sx={{ color: '#FBBF24' }} />,
          text: '保存中...',
          color: '#FBBF24',
          bgColor: 'rgba(251, 191, 36, 0.1)',
        };
      case 'saved':
        return {
          icon: <CheckIcon sx={{ fontSize: 16, color: '#34D399' }} />,
          text: lastSaved ? formatLastSaved(lastSaved) : '保存完了',
          color: '#34D399',
          bgColor: 'rgba(52, 211, 153, 0.1)',
        };
      case 'error':
        return {
          icon: <ErrorIcon sx={{ fontSize: 16, color: '#EF4444' }} />,
          text: '保存に失敗しました',
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
        };
      default:
        return {
          icon: <SaveIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />,
          text: '未保存',
          color: '#9CA3AF',
          bgColor: 'rgba(156, 163, 175, 0.1)',
        };
    }
  };

  if (!isVisible) {
    return null;
  }

  const content = getIndicatorContent();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1200,
      }}
    >
      {/* 通知バナー */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
          >
            <Paper
              sx={{
                background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${content.color}40`,
                borderRadius: 2,
                p: 2,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 200,
              }}
            >
              {content.icon}
              <Typography variant="body2" color={content.color} fontWeight="medium">
                {content.text}
              </Typography>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 常時表示インジケーター */}
      <Fade in={!showNotification}>
        <Paper
          sx={{
            background: 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.9) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CloudIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
          <Typography variant="caption" color="#9CA3AF">
            {lastSaved ? formatLastSaved(lastSaved) : '未保存'}
          </Typography>
        </Paper>
      </Fade>
    </Box>
  );
};