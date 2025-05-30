import { createTheme } from '@mui/material/styles';

export const coneaTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ff88',
      light: '#66ffb2',
      dark: '#00cc66',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ff0088',
      light: '#ff66b2',
      dark: '#cc0066',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0a0a0a',
      paper: 'rgba(20, 20, 20, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    error: {
      main: '#ff3366',
    },
    warning: {
      main: '#ffaa00',
    },
    info: {
      main: '#00aaff',
    },
    success: {
      main: '#00ff88',
    },
  },
  typography: {
    fontFamily: '"SF Pro Display", "Helvetica Neue", "Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: {
      fontSize: '4rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontSize: '3rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '0',
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '0',
      lineHeight: 1.6,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0, 255, 136, 0.3)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
          boxShadow: '0 4px 16px rgba(0, 255, 136, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
            boxShadow: '0 8px 24px rgba(0, 255, 136, 0.5)',
          },
        },
        outlined: {
          borderWidth: 2,
          borderColor: '#00ff88',
          color: '#00ff88',
          '&:hover': {
            borderWidth: 2,
            borderColor: '#66ffb2',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.9) 0%, rgba(30, 30, 30, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-8px) scale(1.02)',
            boxShadow: '0 24px 48px rgba(0, 255, 136, 0.2)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
              borderWidth: 2,
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 255, 136, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00ff88',
              borderWidth: 2,
              boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)',
            },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': {
              color: '#00ff88',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.1)',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
          },
        },
      },
    },
  },
});