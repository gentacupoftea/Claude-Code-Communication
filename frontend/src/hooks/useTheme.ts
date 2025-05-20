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
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    secondary: {
      main: '#06B6D4',
      light: '#22D3EE',
      dark: '#0891B2',
    },
    background: {
      default: '#F0FDF4',
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
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
  },
};

const darkTheme: ThemeOptions = {
  ...lightTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    secondary: {
      main: '#6B7280',
      light: '#9CA3AF',
      dark: '#4B5563',
    },
    background: {
      default: '#000000',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#F3F4F6',
      secondary: '#9CA3AF',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
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