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
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4F46E5',
    },
    secondary: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
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
      main: '#818CF8',
      light: '#A5B4FC',
      dark: '#6366F1',
    },
    secondary: {
      main: '#FCD34D',
      light: '#FDE68A',
      dark: '#F59E0B',
    },
    background: {
      default: '#0F172A',
      paper: '#1E293B',
    },
    info: {
      main: '#60A5FA',
      light: '#93C5FD',
      dark: '#3B82F6',
    },
    success: {
      main: '#34D399',
      light: '#6EE7B7',
      dark: '#10B981',
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
  }, [themeMode, dispatch]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme && savedTheme !== themeMode) {
      dispatch(setTheme(savedTheme));
    }
  }, [dispatch, themeMode]);

  const theme = createTheme(themeMode === 'light' ? lightTheme : darkTheme);

  return {
    theme,
    themeMode,
    toggleTheme,
  };
};

export default useTheme;