import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
  useTheme,
} from '@mui/material';
import {
  HomeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  DocumentTextIcon,
  CpuChipIcon,
  PresentationChartLineIcon,
  RectangleStackIcon,
  LinkIcon,
  UserIcon,
  BellIcon,
  BeakerIcon,
  QuestionMarkCircleIcon as HelpIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: 'permanent' | 'temporary';
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
  { name: 'AI Chat Space', path: '/chat', icon: CpuChipIcon },
  { name: 'Orders', path: '/orders', icon: ShoppingBagIcon },
  { name: 'Customers', path: '/customers', icon: UserGroupIcon },
  { name: 'Analytics', path: '/analytics', icon: ChartBarIcon },
  { name: 'Dashboard Editor', path: '/dashboard-editor', icon: PresentationChartLineIcon },
  { name: 'Saved Dashboards', path: '/saved-dashboards', icon: RectangleStackIcon },
  { name: 'API Settings', path: '/api-settings', icon: LinkIcon },
  { name: 'Reports', path: '/reports', icon: DocumentTextIcon },
  { name: 'Profile', path: '/profile', icon: UserIcon },
  { name: 'Notifications', path: '/notifications', icon: BellIcon },
  { name: 'Settings', path: '/settings', icon: CogIcon },
  { name: 'Demo Components', path: '/demo/data-components', icon: BeakerIcon },
  { name: 'Debug Demo', path: '/debug', icon: BeakerIcon },
  { name: 'Help System', path: '/help', icon: HelpIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ open, onClose, variant }) => {
  const theme = useTheme();
  const drawerWidth = 200;

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      backgroundColor: theme.palette.background.paper,
      position: 'relative',
    }}>
      <Toolbar sx={{ 
        backgroundColor: 'transparent',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography 
          variant="h6" 
          noWrap 
          component="div" 
          sx={{
            background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
          }}
        >
          conea
        </Typography>
      </Toolbar>
      <List sx={{ p: 2 }}>
        {navigation.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
            <NavLink
              to={item.path}
              style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
            >
              {({ isActive }) => (
                <ListItemButton 
                  selected={isActive}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)'
                        : 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                      color: '#FFFFFF',
                      '& .MuiListItemIcon-root': {
                        color: '#FFFFFF',
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(129, 140, 248, 0.1)'
                        : 'rgba(99, 102, 241, 0.1)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <ListItemIcon sx={{ 
                    color: isActive ? '#FFFFFF' : theme.palette.text.secondary,
                    minWidth: 40,
                  }}>
                    <item.icon className="h-5 w-5" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name} 
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile.
      }}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      {drawer}
    </Drawer>
  );
};

export default Sidebar;