/**
 * テーマフック
 * ダークモード/ライトモードの切り替えを管理
 */
import { useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { createTheme, ThemeOptions } from '@mui/material/styles';
import { RootState } from '../store';
import { setTheme } from '../store/slices/settingsSlice';

const lightTheme: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#34D399', // Emerald-400 (薄い緑)
      light: '#6EE7B7', // Emerald-300
      dark: '#10B981',  // Emerald-500
    },
    secondary: {
      main: '#60A5FA', // Blue-400 (補完色)
      light: '#93C5FD', // Blue-300
      dark: '#3B82F6',  // Blue-500
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    info: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
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
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transform: 'translateY(-1px)',
            transition: 'all 0.2s ease-in-out',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
  },
};

const darkTheme: ThemeOptions = {
  ...lightTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#6EE7B7', // Emerald-300 for dark mode
      light: '#A7F3D0', // Emerald-200
      dark: '#34D399',  // Emerald-400
    },
    secondary: {
      main: '#93C5FD', // Blue-300 for dark mode
      light: '#BFDBFE', // Blue-200
      dark: '#60A5FA',  // Blue-400
    },
    background: {
      default: '#0F172A', // Slate 900
      paper: '#1E293B', // Slate 800
    },
    text: {
      primary: '#F1F5F9', // Slate 100
      secondary: '#94A3B8', // Slate 400
    },
    divider: '#334155', // Slate 700
    info: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
  },
};

export const useTheme = () => {
  const dispatch = useDispatch();
  const themeMode = useSelector((state: RootState) => state.settings.theme);

  const toggleTheme = useCallback(() => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    dispatch(setTheme(newTheme));
    localStorage.setItem('theme', newTheme);
    
    // Immediately update the dark class
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode, dispatch]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme && savedTheme !== themeMode) {
      dispatch(setTheme(savedTheme));
    }
  }, [dispatch, themeMode]);

  // Tailwind dark mode class management
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  const theme = createTheme(themeMode === 'light' ? lightTheme : darkTheme);

  return {
    theme,
    themeMode,
    toggleTheme,
  };
};

export default useTheme;