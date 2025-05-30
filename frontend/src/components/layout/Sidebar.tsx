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
import { ConeaLogo } from '../branding/ConeaLogo';
import {
  Home as HomeIcon,
  ShoppingBag as ShoppingBagIcon,
  Group as UserGroupIcon,
  BarChart as ChartBarIcon,
  Settings as CogIcon,
  Description as DocumentTextIcon,
  Computer as CpuChipIcon,
  TrendingUp as PresentationChartLineIcon,
  Dashboard as RectangleStackIcon,
  Link as LinkIcon,
  Person as UserIcon,
  Notifications as BellIcon,
  Science as BeakerIcon,
  Help as HelpIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: 'permanent' | 'temporary';
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
  { name: 'Analytics', path: '/analytics', icon: ChartBarIcon },
  { name: 'AI Chat Space', path: '/chat', icon: CpuChipIcon },
  { name: 'Persona Analysis', path: '/persona-analysis', icon: PsychologyIcon },
  { name: 'Orders', path: '/orders', icon: ShoppingBagIcon },
  { name: 'Customers', path: '/customers', icon: UserGroupIcon },
  { name: 'Products', path: '/products', icon: ShoppingBagIcon },
  { name: 'Reports', path: '/reports', icon: DocumentTextIcon },
  { name: 'Settings', path: '/settings', icon: CogIcon },
  { name: 'Profile', path: '/profile', icon: UserIcon },
  { name: 'Help', path: '/help', icon: HelpIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ open, onClose, variant }) => {
  const theme = useTheme();
  const drawerWidth = 200;

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      backgroundColor: theme.palette.background.paper,
      position: 'relative',
      borderRight: `1px solid ${theme.palette.divider}`,
    }}>
      <Toolbar sx={{ 
        backgroundColor: 'transparent',
        borderBottom: `1px solid ${theme.palette.divider}`,
        px: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              background: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.15)' 
                : 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px 0 rgba(255, 255, 255, 0.1)'
                : '0 4px 12px 0 rgba(52, 211, 153, 0.4)',
              border: theme.palette.mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.2)'
                : 'none',
            }}
          >
            <ConeaLogo 
              variant="icon-only" 
              size="sm"
              width={20}
              height={20}
            />
          </Box>
        </Box>
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
                      background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 4px 12px 0 rgba(52, 211, 153, 0.4)',
                      '& .MuiListItemIcon-root': {
                        color: '#FFFFFF',
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(52, 211, 153, 0.1)'
                        : 'rgba(52, 211, 153, 0.08)',
                      transform: 'translateX(4px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <ListItemIcon sx={{ 
                    color: isActive ? '#FFFFFF' : theme.palette.text.secondary,
                    minWidth: 40,
                  }}>
                    <item.icon />
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