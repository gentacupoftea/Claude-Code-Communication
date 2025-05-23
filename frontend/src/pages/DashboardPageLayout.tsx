import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box, AppBar, Toolbar, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, Brightness4, Brightness7 } from '@mui/icons-material';
import { useTheme as useAppTheme } from '../hooks/useTheme';
import { ConeaLogo } from '../components/branding/ConeaLogo';
import Sidebar from '../components/layout/Sidebar';

// Import page components
// import DashboardSummary from '../components/dashboard/DashboardSummary'; // Temporarily disabled
import AnalyticsCenter from '../components/analytics/AnalyticsCenter';
import AiChatSpace from '../components/chat/AiChatSpace';
import OrderManagement from '../components/orders/OrderManagement';
import CustomerManagement from '../components/customers/CustomerManagement';
import ProductManagement from '../components/products/ProductManagement';
import ReportsCenter from '../components/reports/ReportsCenter';
import SettingsCenter from '../components/settings/SettingsCenter';
import ProfileManagement from '../components/profile/ProfileManagement';
import HelpSystem from '../components/help/HelpSystem';

const DashboardPageLayout: React.FC = () => {
  const theme = useTheme();
  const { toggleTheme, themeMode } = useAppTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawerWidth = 200;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Function to render content based on current path
  const renderContent = () => {
    const path = location.pathname;
    
    if (path.startsWith('/analytics')) {
      return <AnalyticsCenter />;
    } else if (path.startsWith('/chat')) {
      return <AiChatSpace />;
    } else if (path.startsWith('/orders')) {
      return <OrderManagement />;
    } else if (path.startsWith('/customers')) {
      return <CustomerManagement />;
    } else if (path.startsWith('/products')) {
      return <ProductManagement />;
    } else if (path.startsWith('/reports')) {
      return <ReportsCenter />;
    } else if (path.startsWith('/settings')) {
      return <SettingsCenter />;
    } else if (path.startsWith('/profile')) {
      return <ProfileManagement />;
    } else if (path.startsWith('/help')) {
      return <HelpSystem />;
    } else {
      // Default to analytics dashboard
      return <AnalyticsCenter />;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' 
            : 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
          color: '#FFFFFF',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
        elevation={0}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, color: 'white' }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            {!isMobile && (
              <ConeaLogo 
                variant="horizontal" 
                size="lg"
                width={200}
                height={45}
                forceWhiteText={true}
              />
            )}
            {isMobile && (
              <ConeaLogo 
                variant="icon-only" 
                size="sm"
                width={28}
                height={28}
              />
            )}
          </Box>
          <IconButton 
            onClick={toggleTheme}
            color="inherit" 
            sx={{ 
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            {themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar
        open={mobileOpen}
        onClose={handleDrawerToggle}
        variant={isMobile ? 'temporary' : 'permanent'}
      />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {renderContent()}
      </Box>
    </Box>
  );
};

export default DashboardPageLayout;