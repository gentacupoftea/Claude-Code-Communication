/**
 * 拡張通知ポップアップコンポーネント
 * 
 * 通知コンテキストを使用した高機能な通知ポップアップ表示
 */
import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  Avatar,
  Chip,
  ListItemButton,
  Tooltip,
  Collapse,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  FiberManualRecord,
  ShoppingCart,
  TrendingUp,
  Warning,
  CheckCircle,
  Info,
  Error as ErrorIcon,
  Inventory,
  Computer,
  ClearAll,
  CheckCircleOutline,
  Delete,
  Settings,
  NotificationsActive,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/format';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

// アニメーション用の設定
const variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 20 }
};

const EnhancedNotificationPopup: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  // 通知コンテキストからデータを取得
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    filters, 
    setFilters,
    createTestNotification,
  } = useNotifications();
  
  // ポップアップに表示する通知数を制限
  const displayedNotifications = expanded 
    ? notifications 
    : notifications.slice(0, 5);
  
  // 通知アイコンクリックでポップアップを開く
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  // ポップアップを閉じる
  const handleClose = () => {
    setAnchorEl(null);
    setExpanded(false);
  };
  
  // 通知クリック時の処理
  const handleNotificationClick = async (id: string, actionUrl?: string) => {
    setLoadingAction(id);
    
    try {
      // 既読にする
      await markAsRead(id);
      
      // アクションURLがあれば遷移
      if (actionUrl) {
        navigate(actionUrl);
        handleClose();
      }
    } finally {
      setLoadingAction(null);
    }
  };
  
  // すべて既読にする
  const handleMarkAllAsRead = async () => {
    setLoadingAction('all');
    
    try {
      await markAllAsRead();
    } finally {
      setLoadingAction(null);
    }
  };
  
  // 通知一覧ページへ遷移
  const handleViewAll = () => {
    navigate('/notifications');
    handleClose();
  };
  
  // もっと見るボタンのクリック
  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };
  
  // 通知設定ページへ遷移
  const handleOpenSettings = () => {
    navigate('/settings?tab=notifications');
    handleClose();
  };
  
  // 通知アイコンの取得
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      case 'order':
        return <ShoppingCart color="primary" />;
      case 'sales':
        return <TrendingUp color="primary" />;
      case 'inventory':
        return <Inventory color="primary" />;
      case 'system':
        return <Computer color="primary" />;
      default:
        return <Info />;
    }
  };
  
  // 通知バッジのアニメーション
  useEffect(() => {
    if (unreadCount > 0) {
      const badge = document.querySelector('.MuiBadge-badge');
      if (badge) {
        badge.classList.add('pulse-animation');
        setTimeout(() => {
          badge.classList.remove('pulse-animation');
        }, 1000);
      }
    }
  }, [unreadCount]);
  
  const open = Boolean(anchorEl);
  
  return (
    <>
      <Tooltip title="通知">
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{ ml: 2 }}
        >
          <Badge 
            badgeContent={unreadCount} 
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                '&.pulse-animation': {
                  animation: 'pulse-animation 1s ease-in-out',
                },
                '@keyframes pulse-animation': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' },
                },
              },
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { 
            width: 360, 
            maxHeight: 480,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            overflow: 'hidden',
          }
        }}
      >
        {/* ヘッダー */}
        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActive />
            <Typography variant="h6">通知</Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                sx={{ 
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  fontWeight: 'bold',
                  height: 20,
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="すべて既読にする">
                <IconButton 
                  size="small" 
                  onClick={handleMarkAllAsRead}
                  disabled={loadingAction === 'all'}
                  sx={{ color: 'primary.contrastText' }}
                >
                  {loadingAction === 'all' ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <CheckCircleOutline fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="通知設定">
              <IconButton 
                size="small" 
                onClick={handleOpenSettings}
                sx={{ color: 'primary.contrastText' }}
              >
                <Settings fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Divider />

        {/* 通知リスト */}
        {notifications.length > 0 ? (
          <>
            <List sx={{ maxHeight: 320, overflow: 'auto', px: 0 }}>
              <AnimatePresence>
                {displayedNotifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    variants={variants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                  >
                    <ListItem 
                      disablePadding
                      sx={{
                        bgcolor: notification.read ? 'transparent' : 'action.hover',
                        borderLeft: notification.read ? 'none' : `4px solid ${theme.palette.primary.main}`,
                      }}
                    >
                      <ListItemButton
                        onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                        disabled={loadingAction === notification.id}
                        sx={{ py: 1.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {loadingAction === notification.id ? (
                            <CircularProgress size={24} />
                          ) : (
                            <Avatar sx={{ 
                              width: 32, 
                              height: 32,
                              bgcolor: 'background.paper',
                              color: theme.palette.text.primary,
                              boxShadow: theme.shadows[1],
                            }}>
                              {getNotificationIcon(notification.type)}
                            </Avatar>
                          )}
                        </ListItemIcon>
                        
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography 
                                variant="subtitle2"
                                sx={{ 
                                  fontWeight: notification.read ? 400 : 600,
                                  color: notification.read ? 'text.primary' : 'primary.main',
                                }}
                              >
                                {notification.title}
                              </Typography>
                              
                              {!notification.read && (
                                <FiberManualRecord sx={{ fontSize: 8, color: 'primary.main' }} />
                              )}
                              
                              {notification.priority === 'high' && (
                                <Chip 
                                  label="重要" 
                                  size="small" 
                                  color="error" 
                                  sx={{ height: 20, '& .MuiChip-label': { px: 1 } }} 
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography
                                component="span"
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {notification.message}
                              </Typography>
                              
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                mt: 0.5,
                              }}>
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.disabled"
                                >
                                  {formatRelativeTime(notification.timestamp)}
                                </Typography>
                                
                                <Chip
                                  label={notification.category}
                                  size="small"
                                  variant="outlined"
                                  sx={{ 
                                    height: 20, 
                                    '& .MuiChip-label': { 
                                      px: 1,
                                      fontSize: '0.6rem',
                                    } 
                                  }}
                                />
                              </Box>
                            </>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            
            {/* もっと見るボタン（通知が6件以上ある場合のみ表示） */}
            {notifications.length > 5 && (
              <Box sx={{ p: 1, textAlign: 'center' }}>
                <Button 
                  size="small" 
                  onClick={handleToggleExpand}
                >
                  {expanded ? '表示を減らす' : `さらに${notifications.length - 5}件を表示`}
                </Button>
              </Box>
            )}
          </>
        ) : (
          // 通知がない場合
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              通知はありません
            </Typography>
            <Button 
              size="small" 
              onClick={() => createTestNotification()}
              sx={{ mt: 2 }}
            >
              テスト通知を作成
            </Button>
          </Box>
        )}

        <Divider />

        {/* フッター */}
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Delete />}
            color="inherit"
            disabled={notifications.length === 0}
          >
            すべて削除
          </Button>
          
          <Button
            size="small"
            variant="contained"
            onClick={handleViewAll}
          >
            すべての通知を見る
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default EnhancedNotificationPopup;