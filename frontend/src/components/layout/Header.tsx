import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Bars3Icon as MenuIcon,
  UserIcon,
  Cog6ToothIcon as CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationPopup } from '../notifications/NotificationPopup';
import { useTheme } from '../../hooks';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
  isMobile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isMobile = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toggleTheme, theme } = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const handleProfile = () => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const handleSettings = () => {
    navigate('/settings');
    handleProfileMenuClose();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #1E293B 0%, #334155 100%)' 
          : 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
        color: theme.palette.primary.contrastText,
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
      }}
      elevation={0}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          conea
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* テーマ切り替えボタン */}
          <IconButton onClick={toggleTheme} color="inherit">
            {theme.palette.mode === 'dark' ? '🌞' : '🌙'}
          </IconButton>

          {/* 通知ボタン */}
          <NotificationPopup />

          {/* プロフィールメニュー */}
          <IconButton
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>

          {/* ハンバーガーメニュー（モバイルのみ） */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={onMenuClick}
              edge="end"
            >
              <MenuIcon className="h-6 w-6" />
            </IconButton>
          )}
          <Menu
            id="menu-appbar"
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
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle1">{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleProfile}>
              <UserIcon className="h-5 w-5 mr-2" />
              プロフィール
            </MenuItem>
            <MenuItem onClick={handleSettings}>
              <CogIcon className="h-5 w-5 mr-2" />
              設定
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
              ログアウト
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;