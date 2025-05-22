/**
 * Sidebar Component - ナビゲーションサイドバー
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  SmartToy as AgentIcon,
  VpnKey as KeyIcon,
  Monitor as MonitoringIcon,
  FolderSpecial as ProjectIcon,
  Receipt as BillingIcon,
  Settings as SettingsIcon,
  Psychology as AIIcon,
  Chat as SlackIcon,
} from '@mui/icons-material';

// Hooks
import { useDashboard } from '../../contexts/DashboardContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactElement;
  badge?: string;
  color?: 'primary' | 'secondary' | 'warning' | 'error';
}

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { stats } = useDashboard();

  // ナビゲーションアイテム定義
  const navItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'ダッシュボード',
      icon: <DashboardIcon />,
    },
    {
      path: '/agents',
      label: 'AI エージェント',
      icon: <AgentIcon />,
      badge: stats.activeAgents ? stats.activeAgents.toString() : undefined,
      color: 'primary',
    },
    {
      path: '/api-keys',
      label: 'API キー管理',
      icon: <KeyIcon />,
    },
    {
      path: '/slack',
      label: 'Slack統合',
      icon: <SlackIcon />,
      badge: stats.slackConnected ? 'ON' : 'OFF',
      color: stats.slackConnected ? 'primary' : 'warning',
    },
    {
      path: '/monitoring',
      label: '監視・分析',
      icon: <MonitoringIcon />,
      badge: (stats.alertCount && stats.alertCount > 0) ? stats.alertCount.toString() : undefined,
      color: 'warning',
    },
    {
      path: '/projects',
      label: 'プロジェクト',
      icon: <ProjectIcon />,
      badge: stats.activeProjects ? stats.activeProjects.toString() : undefined,
      color: 'secondary',
    },
    {
      path: '/billing',
      label: '課金・請求',
      icon: <BillingIcon />,
    },
    {
      path: '/settings',
      label: '設定',
      icon: <SettingsIcon />,
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  return (
    <Box sx={{ height: '100%', bgcolor: 'background.paper' }}>
      {/* ヘッダー */}
      <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AIIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Conea
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          MultiLLM 自律システム
        </Typography>
      </Box>

      {/* ナビゲーションリスト */}
      <List sx={{ px: 2, py: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  ...(isActive && {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  }),
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? 'inherit' : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
                {item.badge && (
                  <Chip
                    label={item.badge}
                    size="small"
                    color={item.color || 'default'}
                    sx={{
                      height: 20,
                      fontSize: '0.75rem',
                      ...(isActive && {
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        color: 'inherit',
                      }),
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ mx: 2, my: 2 }} />

      {/* システム状態表示 */}
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          システム状態
        </Typography>
        
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'success.main',
                mr: 1,
              }}
            />
            <Typography variant="caption">
              MultiLLM オンライン
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: stats.slackConnected ? 'success.main' : 'error.main',
                mr: 1,
              }}
            />
            <Typography variant="caption">
              Slack {stats.slackConnected ? '接続済み' : '未接続'}
            </Typography>
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            稼働時間: {stats.uptime || '0h 0m'}
          </Typography>
        </Box>
      </Box>

      {/* フッター */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          borderTop: '1px solid #e5e7eb',
          bgcolor: 'grey.50',
        }}
      >
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          Conea v1.0.0
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          © 2025 Claude Code Team
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar;