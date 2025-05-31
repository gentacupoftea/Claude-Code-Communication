/**
 * Notification Center - 通知センター
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Button,
  Divider,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Close,
  Info,
  CheckCircle,
  Warning,
  Error,
  MarkEmailRead,
} from '@mui/icons-material';
import { useDashboard } from '../../contexts/DashboardContext';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useDashboard();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          maxWidth: '90vw',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Notifications</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        <Button
          fullWidth
          variant="outlined"
          onClick={markAllNotificationsRead}
          startIcon={<MarkEmailRead />}
          sx={{ mb: 2 }}
        >
          Mark All as Read
        </Button>

        <Divider />

        <List>
          {notifications.map((notification) => (
            <ListItem
              key={notification.id}
              sx={{
                bgcolor: notification.read ? 'transparent' : 'action.hover',
                borderRadius: 1,
                mb: 1,
                cursor: 'pointer',
              }}
              onClick={() => markNotificationRead(notification.id)}
            >
              <ListItemIcon>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {getNotificationIcon(notification.type)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">{notification.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(notification.timestamp)}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {notification.message}
                    </Typography>
                    <Chip
                      size="small"
                      label={notification.type}
                      color={notification.type === 'error' ? 'error' : notification.type === 'warning' ? 'warning' : notification.type === 'success' ? 'success' : 'info'}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        {notifications.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default NotificationCenter;