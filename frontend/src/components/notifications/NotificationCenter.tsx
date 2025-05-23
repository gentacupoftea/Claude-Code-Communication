import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Button,
  Chip,
  Box,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Settings as SettingsIcon,
  MarkEmailRead as MarkReadIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import realtimeNotificationService, { 
  NotificationData, 
  NotificationSettings 
} from '../../services/realtimeNotificationService';

interface NotificationCenterProps {
  maxHeight?: number;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  maxHeight = 400 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const open = Boolean(anchorEl);

  useEffect(() => {
    // Load initial data
    setNotifications(realtimeNotificationService.getNotificationHistory(50));
    setUnreadCount(realtimeNotificationService.getUnreadCount());
    setSettings(realtimeNotificationService.getSettings());
    setIsConnected(realtimeNotificationService.getConnectionStatus());

    // Set up event listeners
    const handleNotification = (notification: NotificationData) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      setUnreadCount(realtimeNotificationService.getUnreadCount());
    };

    const handleNotificationUpdated = () => {
      setUnreadCount(realtimeNotificationService.getUnreadCount());
    };

    const handleAllRead = () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    };

    const handleSettingsUpdated = (newSettings: NotificationSettings) => {
      setSettings(newSettings);
    };

    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);

    realtimeNotificationService.on('notification', handleNotification);
    realtimeNotificationService.on('notificationUpdated', handleNotificationUpdated);
    realtimeNotificationService.on('allNotificationsRead', handleAllRead);
    realtimeNotificationService.on('settingsUpdated', handleSettingsUpdated);
    realtimeNotificationService.on('connected', handleConnected);
    realtimeNotificationService.on('disconnected', handleDisconnected);

    return () => {
      realtimeNotificationService.off('notification', handleNotification);
      realtimeNotificationService.off('notificationUpdated', handleNotificationUpdated);
      realtimeNotificationService.off('allNotificationsRead', handleAllRead);
      realtimeNotificationService.off('settingsUpdated', handleSettingsUpdated);
      realtimeNotificationService.off('connected', handleConnected);
      realtimeNotificationService.off('disconnected', handleDisconnected);
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setShowSettings(false);
  };

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.read) {
      realtimeNotificationService.markAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }
    
    // Execute notification actions
    if (notification.actions && notification.actions.length > 0) {
      notification.actions[0].action();
    }
  };

  const handleMarkAllRead = () => {
    realtimeNotificationService.markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'success': return <SuccessIcon color="success" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  const handleSettingChange = (setting: keyof NotificationSettings, value: any) => {
    if (settings) {
      const newSettings = { ...settings, [setting]: value };
      realtimeNotificationService.updateSettings(newSettings);
    }
  };

  const handleCategoryChange = (category: string, enabled: boolean) => {
    if (settings) {
      const newCategories = { ...settings.categories, [category]: enabled };
      realtimeNotificationService.updateSettings({ categories: newCategories });
    }
  };

  return (
    <>
      <Tooltip title={`${unreadCount} unread notifications`}>
        <IconButton
          onClick={handleClick}
          color="inherit"
          aria-label="notifications"
        >
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: maxHeight,
            width: '400px',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Notifications</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                size="small" 
                color={isConnected ? 'success' : 'error'}
                label={isConnected ? 'Connected' : 'Disconnected'}
              />
              <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<MarkReadIcon />}
              onClick={handleMarkAllRead}
              sx={{ mb: 1 }}
            >
              Mark all as read
            </Button>
          )}
        </Box>

        {showSettings && settings && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>Settings</Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enablePush}
                  onChange={(e) => handleSettingChange('enablePush', e.target.checked)}
                />
              }
              label="Browser notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableSound}
                  onChange={(e) => handleSettingChange('enableSound', e.target.checked)}
                />
              }
              label="Sound alerts"
            />
            
            <Typography variant="caption" display="block" sx={{ mt: 1, mb: 1 }}>Categories:</Typography>
            {Object.entries(settings.categories).map(([category, enabled]) => (
              <FormControlLabel
                key={category}
                control={
                  <Switch
                    size="small"
                    checked={enabled}
                    onChange={(e) => handleCategoryChange(category, e.target.checked)}
                  />
                }
                label={category.charAt(0).toUpperCase() + category.slice(1)}
              />
            ))}
          </Box>
        )}

        <List sx={{ p: 0, maxHeight: maxHeight - 150, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No notifications"
                secondary="You're all caught up!"
                sx={{ textAlign: 'center' }}
              />
            </ListItem>
          ) : (
            notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: notification.read ? 'normal' : 'bold',
                            color: notification.read ? 'text.secondary' : 'text.primary'
                          }}
                        >
                          {notification.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={notification.type}
                          color={getNotificationColor(notification.type) as any}
                          variant={notification.read ? 'outlined' : 'filled'}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: notification.read ? 'text.disabled' : 'text.secondary',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </Menu>
    </>
  );
};

export default NotificationCenter;