import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  AccountCircle,
  Settings,
  Logout,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

interface TopBarProps {
  onMenuClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = React.useState<null | HTMLElement>(null);

  // Redux state
  const activeTasks = useSelector((state: RootState) => state.tasks.activeCount);
  const systemStatus = useSelector((state: RootState) => state.system.status);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };

  const isMenuOpen = Boolean(anchorEl);
  const isNotificationOpen = Boolean(notificationAnchor);

  const notifications = [
    { id: 1, message: 'PR #123 レビュー完了', time: '5分前' },
    { id: 2, message: 'Worker 3 メモリ警告', time: '10分前' },
    { id: 3, message: 'デプロイ成功', time: '1時間前' },
  ];

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          MultiLLM System Dashboard
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Status Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: systemStatus === 'healthy' ? 'success.main' : 'warning.main',
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {activeTasks} Active Tasks
            </Typography>
          </Box>

          {/* Notifications */}
          <IconButton
            size="large"
            aria-label="show notifications"
            color="inherit"
            onClick={handleNotificationMenuOpen}
          >
            <Badge badgeContent={notifications.length} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* Profile */}
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>A</Avatar>
          </IconButton>
        </Box>
      </Toolbar>

      {/* Notification Menu */}
      <Menu
        anchorEl={notificationAnchor}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isNotificationOpen}
        onClose={handleMenuClose}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">通知</Typography>
        </Box>
        <Divider />
        {notifications.map((notification) => (
          <MenuItem key={notification.id} onClick={handleMenuClose}>
            <Box>
              <Typography variant="body2">{notification.message}</Typography>
              <Typography variant="caption" color="text.secondary">
                {notification.time}
              </Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <Typography variant="body2" color="primary">
            すべての通知を見る
          </Typography>
        </MenuItem>
      </Menu>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isMenuOpen}
        onClose={handleMenuClose}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">Admin User</Typography>
          <Typography variant="caption" color="text.secondary">
            admin@conea.ai
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <Settings fontSize="small" sx={{ mr: 1 }} />
          設定
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Logout fontSize="small" sx={{ mr: 1 }} />
          ログアウト
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default TopBar;