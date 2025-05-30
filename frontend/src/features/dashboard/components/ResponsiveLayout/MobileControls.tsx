import React, { useState } from 'react';
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Drawer,
  useMediaQuery,
  useTheme,
  Fab,
  Tooltip,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Widgets as WidgetsIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  TouchApp as TouchIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileControlsProps {
  isEditing: boolean;
  isFullscreen: boolean;
  onToggleEdit: () => void;
  onToggleFullscreen: () => void;
  onOpenWidgetSelector: () => void;
  onOpenNLQuery: () => void;
  onOpenSettings: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  isEditing,
  isFullscreen,
  onToggleEdit,
  onToggleFullscreen,
  onOpenWidgetSelector,
  onOpenNLQuery,
  onOpenSettings,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  if (!isMobile) {
    return null;
  }

  const actions = [
    {
      icon: <WidgetsIcon />,
      name: 'ウィジェット追加',
      onClick: onOpenWidgetSelector,
      color: '#34D399',
    },
    {
      icon: <AddIcon />,
      name: '自然言語で追加',
      onClick: onOpenNLQuery,
      color: '#60A5FA',
    },
    {
      icon: <EditIcon />,
      name: isEditing ? '編集終了' : '編集開始',
      onClick: onToggleEdit,
      color: isEditing ? '#EF4444' : '#F472B6',
    },
    {
      icon: isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
      name: isFullscreen ? '全画面終了' : '全画面表示',
      onClick: onToggleFullscreen,
      color: '#A78BFA',
    },
    {
      icon: <SettingsIcon />,
      name: '設定',
      onClick: onOpenSettings,
      color: '#FBBF24',
    },
  ];

  return (
    <>
      {/* クイックアクションパネル */}
      <AnimatePresence>
        {showQuickActions && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              bottom: 80,
              left: 16,
              right: 16,
              zIndex: 1200,
            }}
          >
            <Paper
              sx={{
                background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                borderRadius: 3,
                p: 2,
              }}
            >
              <Box
                display="flex"
                justifyContent="space-around"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
              >
                {actions.map((action, index) => (
                  <motion.div
                    key={action.name}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <Tooltip title={action.name} placement="top">
                      <IconButton
                        onClick={() => {
                          action.onClick();
                          setShowQuickActions(false);
                        }}
                        sx={{
                          backgroundColor: `${action.color}20`,
                          color: action.color,
                          width: 56,
                          height: 56,
                          m: 0.5,
                          '&:hover': {
                            backgroundColor: `${action.color}30`,
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {action.icon}
                      </IconButton>
                    </Tooltip>
                  </motion.div>
                ))}
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* メインファブボタン */}
      <Fab
        onClick={() => setShowQuickActions(!showQuickActions)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1300,
          background: showQuickActions 
            ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
            : 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
          color: '#FFFFFF',
          width: 64,
          height: 64,
          '&:hover': {
            background: showQuickActions 
              ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
              : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            transform: 'scale(1.1)',
          },
          transition: 'all 0.3s ease',
          boxShadow: '0 8px 32px rgba(52, 211, 153, 0.4)',
        }}
      >
        <motion.div
          animate={{ rotate: showQuickActions ? 45 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {showQuickActions ? <CloseIcon /> : <MenuIcon />}
        </motion.div>
      </Fab>

      {/* 編集モード時の補助ボタン */}
      {isEditing && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            zIndex: 1200,
          }}
        >
          <Tooltip title="タッチヘルプ" placement="top">
            <Fab
              size="small"
              sx={{
                backgroundColor: '#6B7280',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#4B5563',
                },
              }}
            >
              <TouchIcon />
            </Fab>
          </Tooltip>
        </Box>
      )}

      {/* SpeedDial（従来のスタイル） */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 90,
          left: 16,
          zIndex: 1100,
          display: speedDialOpen ? 'block' : 'none',
        }}
      >
        <SpeedDial
          ariaLabel="モバイル操作メニュー"
          sx={{
            '& .MuiFab-primary': {
              backgroundColor: '#34D399',
              '&:hover': {
                backgroundColor: '#059669',
              },
            },
          }}
          icon={<SpeedDialIcon />}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
          open={speedDialOpen}
          direction="up"
        >
          {actions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={() => {
                action.onClick();
                setSpeedDialOpen(false);
              }}
              sx={{
                '& .MuiSpeedDialAction-fab': {
                  backgroundColor: `${action.color}20`,
                  color: action.color,
                  '&:hover': {
                    backgroundColor: `${action.color}30`,
                  },
                },
              }}
            />
          ))}
        </SpeedDial>
      </Box>
    </>
  );
};