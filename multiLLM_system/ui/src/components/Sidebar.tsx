import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Group as WorkersIcon,
  Assignment as TasksIcon,
  Memory as MemoryIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Description as LogsIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

interface SidebarProps {
  open: boolean;
  width: number;
  onToggle: () => void;
}

const menuItems = [
  { 
    path: '/', 
    label: 'ダッシュボード', 
    icon: <DashboardIcon />,
    description: 'システム概要'
  },
  { 
    path: '/workers', 
    label: 'Worker管理', 
    icon: <WorkersIcon />,
    description: 'LLM Worker状況'
  },
  { 
    path: '/tasks', 
    label: 'タスク管理', 
    icon: <TasksIcon />,
    description: '実行中・完了タスク'
  },
  { 
    path: '/memory', 
    label: 'メモリ同期', 
    icon: <MemoryIcon />,
    description: 'OpenMemory連携'
  },
  { 
    path: '/analytics', 
    label: '分析・レポート', 
    icon: <AnalyticsIcon />,
    description: 'パフォーマンス分析'
  },
  { 
    path: '/logs', 
    label: 'ログ・監視', 
    icon: <LogsIcon />,
    description: 'システムログ'
  },
  { 
    path: '/settings', 
    label: '設定', 
    icon: <SettingsIcon />,
    description: 'システム設定'
  },
];

const Sidebar: React.FC<SidebarProps> = ({ open, width }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const systemStatus = useSelector((state: RootState) => state.system.status);
  const activeWorkers = useSelector((state: RootState) => state.workers.activeCount);
  const activeTasks = useSelector((state: RootState) => state.tasks.activeCount);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: open ? width : 64,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? width : 64,
          boxSizing: 'border-box',
          transition: 'width 0.3s ease',
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BotIcon color="primary" sx={{ fontSize: 32 }} />
          {open && (
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                MultiLLM
              </Typography>
              <Typography variant="caption" color="text.secondary">
                統合AI システム
              </Typography>
            </Box>
          )}
        </Box>
        
        {open && (
          <Box sx={{ mt: 2 }}>
            <Chip
              label={`システム: ${systemStatus}`}
              color={getStatusColor(systemStatus) as any}
              size="small"
              sx={{ mb: 1, display: 'block', width: 'fit-content' }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`Workers: ${activeWorkers}`} 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={`Tasks: ${activeTasks}`} 
                size="small" 
                variant="outlined" 
              />
            </Box>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              
              {open && (
                <ListItemText 
                  primary={item.label}
                  secondary={item.description}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                    color: location.pathname === item.path ? 'rgba(255,255,255,0.7)' : 'text.secondary'
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Footer */}
      {open && (
        <Box sx={{ mt: 'auto', p: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            MultiLLM System v1.0.0
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Phase 2 Implementation
          </Typography>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar;