/**
 * 通知ポップアップコンポーネント
 */
import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Notifications,
  FiberManualRecord,
  ShoppingCart,
  TrendingUp,
  Warning,
  CheckCircle,
  Info,
  Error,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/format';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'order' | 'sales';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export const NotificationPopup: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'order',
      title: '新規注文',
      message: '田中太郎様から新規注文が入りました',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5分前
      read: false,
      actionUrl: '/orders/123',
    },
    {
      id: '2',
      type: 'sales',
      title: '売上目標達成',
      message: '今月の売上目標を達成しました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2時間前
      read: false,
    },
    {
      id: '3',
      type: 'warning',
      title: '在庫アラート',
      message: '「商品A」の在庫が残り5個になりました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1日前
      read: true,
      actionUrl: '/inventory/products/A',
    },
    {
      id: '4',
      type: 'info',
      title: 'レポート完了',
      message: '月次売上レポートの生成が完了しました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2日前
      read: true,
      actionUrl: '/reports/123',
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    // 既読にする
    setNotifications(notifications.map(n => 
      n.id === notification.id ? { ...n, read: true } : n
    ));

    // アクションURLがあれば遷移
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      handleClose();
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleViewAll = () => {
    navigate('/notifications');
    handleClose();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      case 'order':
        return <ShoppingCart color="primary" />;
      case 'sales':
        return <TrendingUp color="primary" />;
      default:
        return <Info />;
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ ml: 2 }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <Notifications />
        </Badge>
      </IconButton>

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
          sx: { width: 360, maxHeight: 480 }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">通知</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              すべて既読にする
            </Button>
          )}
        </Box>
        
        <Divider />

        <List sx={{ maxHeight: 360, overflow: 'auto' }}>
          {notifications.map((notification) => (
            <ListItem
              key={notification.id}
              button
              onClick={() => handleNotificationClick(notification)}
              sx={{
                bgcolor: notification.read ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemIcon>
                <Avatar sx={{ bgcolor: 'background.paper' }}>
                  {getNotificationIcon(notification.type)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2">
                      {notification.title}
                    </Typography>
                    {!notification.read && (
                      <FiberManualRecord sx={{ fontSize: 8, color: 'primary.main' }} />
                    )}
                  </Box>
                }
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      component="div"
                      variant="caption"
                      color="text.disabled"
                      sx={{ mt: 0.5 }}
                    >
                      {formatRelativeTime(notification.timestamp)}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="text"
            onClick={handleViewAll}
          >
            すべての通知を見る
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationPopup;