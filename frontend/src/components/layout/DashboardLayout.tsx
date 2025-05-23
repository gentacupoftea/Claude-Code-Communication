import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      minHeight: '100vh', 
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'
        : 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
    }}>
      <Header onMenuClick={handleDrawerToggle} isMobile={isMobile} />
      {!isMobile && (
        <Box sx={{ width: '200px' }}>
          <Sidebar
            open={true}
            onClose={handleDrawerToggle}
            variant="permanent"
          />
        </Box>
      )}
      {isMobile && (
        <Sidebar
          open={mobileOpen}
          onClose={handleDrawerToggle}
          variant="temporary"
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px',
          background: 'transparent',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;