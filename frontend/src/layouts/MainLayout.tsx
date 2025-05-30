import React, { useState } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  Tab,
  Tabs,
  useTheme,
  useMediaQuery,
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { ChatPanel } from '../features/chat/components/ChatPanel/ChatPanel';
import { FileManager } from '../features/fileManager/components/FileManager/FileManager';

const SIDEBAR_WIDTH = 300;

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const sidebarContent = (
    <Box sx={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            color: theme.palette.text.secondary,
            '&.Mui-selected': {
              color: '#34d399',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#34d399',
          },
        }}
      >
        <Tab
          icon={<ChatIcon />}
          label="チャット"
          iconPosition="start"
          sx={{ flex: 1 }}
        />
        <Tab
          icon={<FolderIcon />}
          label="ファイル"
          iconPosition="start"
          sx={{ flex: 1 }}
        />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 0 && <ChatPanel />}
        {activeTab === 1 && <FileManager />}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* アプリバー（モバイル時のみ表示） */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            zIndex: theme.zIndex.drawer + 1,
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: 1,
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleSidebar}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, color: '#34d399' }}>
              Conea
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* サイドバー */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={toggleSidebar}
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            mt: isMobile ? '64px' : 0,
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* メインコンテンツエリア */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: isMobile ? 0 : `${SIDEBAR_WIDTH}px`,
          mt: isMobile ? '64px' : 0,
          overflow: 'auto',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};