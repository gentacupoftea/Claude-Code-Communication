'use client'

import React, { useState } from 'react'
import { Box, CssBaseline, IconButton } from '@mui/material'
import { Menu as MenuIcon } from '@mui/icons-material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ChatInterface } from '@/components/ChatInterface'
import { Sidebar } from '@/components/Sidebar'

const theme = createTheme({
  palette: {
    primary: {
      main: '#34d399',
    },
    secondary: {
      main: '#2bb77e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
})

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            height: '100vh',
            overflow: 'hidden',
            transition: theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginLeft: sidebarOpen ? 0 : `-280px`,
          }}
        >
          {!sidebarOpen && (
            <IconButton
              onClick={handleSidebarToggle}
              sx={{
                position: 'absolute',
                left: 16,
                top: 16,
                zIndex: 1,
                backgroundColor: 'white',
                boxShadow: 1,
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <ChatInterface />
        </Box>
      </Box>
    </ThemeProvider>
  )
}