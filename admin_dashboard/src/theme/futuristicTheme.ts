/**
 * Conea Futuristic Theme
 * 革新的で未来的なデザインテーマ
 */

import { createTheme, alpha } from '@mui/material/styles';

// カスタムカラーパレット
const customColors = {
  // メインの青緑グラデーション
  primary: {
    main: '#34d399',
    light: '#6ee7b7',
    dark: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
  },
  // ネオンブルー
  neon: {
    blue: '#00d4ff',
    purple: '#a855f7',
    pink: '#ec4899',
    gradient: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 50%, #ec4899 100%)',
  },
  // ダーク背景
  dark: {
    primary: '#0a0a0a',
    secondary: '#141414',
    tertiary: '#1a1a1a',
    card: 'rgba(20, 20, 20, 0.8)',
  },
  // グラスモーフィズム
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.3)',
  },
};

// アニメーション設定
export const animations = {
  // ホバー時の浮遊効果
  float: {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 20px 40px rgba(52, 211, 153, 0.3)',
    },
  },
  // グロー効果
  glow: {
    transition: 'all 0.3s ease',
    '&:hover': {
      filter: 'brightness(1.2)',
      textShadow: '0 0 20px rgba(52, 211, 153, 0.8)',
    },
  },
  // パルス効果
  pulse: {
    animation: 'pulse 2s infinite',
    '@keyframes pulse': {
      '0%': {
        boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.4)',
      },
      '70%': {
        boxShadow: '0 0 0 10px rgba(52, 211, 153, 0)',
      },
      '100%': {
        boxShadow: '0 0 0 0 rgba(52, 211, 153, 0)',
      },
    },
  },
};

// グラスモーフィズムスタイル
export const glassStyle = {
  background: customColors.glass.light,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
};

// ネオモーフィズムスタイル
export const neuomorphismStyle = {
  background: customColors.dark.secondary,
  boxShadow: `
    12px 12px 24px 0 rgba(0, 0, 0, 0.5),
    -12px -12px 24px 0 rgba(255, 255, 255, 0.03),
    inset 1px 1px 0 rgba(255, 255, 255, 0.03)
  `,
};

// ホログラフィック効果
export const holographicStyle = {
  background: `
    linear-gradient(
      45deg,
      rgba(255, 0, 255, 0.1) 0%,
      rgba(0, 255, 255, 0.1) 25%,
      rgba(255, 255, 0, 0.1) 50%,
      rgba(255, 0, 255, 0.1) 75%,
      rgba(0, 255, 255, 0.1) 100%
    )
  `,
  backgroundSize: '200% 200%',
  animation: 'holographic 10s ease infinite',
  '@keyframes holographic': {
    '0%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' },
  },
};

// カスタムテーマ作成
export const futuristicTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: customColors.primary.main,
      light: customColors.primary.light,
      dark: customColors.primary.dark,
    },
    secondary: {
      main: customColors.neon.blue,
      light: alpha(customColors.neon.blue, 0.8),
      dark: alpha(customColors.neon.blue, 1),
    },
    background: {
      default: customColors.dark.primary,
      paper: customColors.dark.secondary,
    },
    text: {
      primary: '#ffffff',
      secondary: alpha('#ffffff', 0.7),
    },
    error: {
      main: '#ff4757',
      light: '#ff6b7a',
      dark: '#ee2e45',
    },
    warning: {
      main: '#ffa502',
      light: '#ffb838',
      dark: '#ff8c00',
    },
    success: {
      main: customColors.primary.main,
      light: customColors.primary.light,
      dark: customColors.primary.dark,
    },
    info: {
      main: customColors.neon.blue,
      light: alpha(customColors.neon.blue, 0.8),
      dark: customColors.neon.blue,
    },
  },
  typography: {
    fontFamily: '"Space Grotesk", "Inter", "Roboto", sans-serif',
    h1: {
      fontSize: '3.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      background: customColors.primary.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '2rem',
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
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: customColors.dark.primary,
          },
          '&::-webkit-scrollbar-thumb': {
            background: customColors.primary.main,
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: customColors.primary.light,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...glassStyle,
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: customColors.primary.gradient,
          },
          ...animations.float,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '12px',
          fontWeight: 600,
          padding: '10px 24px',
          position: 'relative',
          overflow: 'hidden',
          ...animations.float,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '0',
            height: '0',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.5)',
            transform: 'translate(-50%, -50%)',
            transition: 'width 0.6s, height 0.6s',
          },
          '&:hover::before': {
            width: '300px',
            height: '300px',
          },
        },
        contained: {
          background: customColors.primary.gradient,
          boxShadow: '0 4px 20px rgba(52, 211, 153, 0.4)',
          '&:hover': {
            boxShadow: '0 6px 30px rgba(52, 211, 153, 0.6)',
          },
        },
        outlined: {
          borderImage: customColors.primary.gradient,
          borderImageSlice: 1,
          borderWidth: '2px',
          borderStyle: 'solid',
          '&:hover': {
            background: alpha(customColors.primary.main, 0.1),
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            background: customColors.glass.light,
            backdropFilter: 'blur(10px)',
            '& fieldset': {
              borderColor: alpha(customColors.primary.main, 0.3),
            },
            '&:hover fieldset': {
              borderColor: alpha(customColors.primary.main, 0.5),
            },
            '&.Mui-focused fieldset': {
              borderColor: customColors.primary.main,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          ...glassStyle,
        },
        elevation1: {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          ...glassStyle,
          borderBottom: `1px solid ${alpha(customColors.primary.main, 0.2)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...glassStyle,
          borderRight: `1px solid ${alpha(customColors.primary.main, 0.2)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          ...glassStyle,
          borderRadius: '20px',
          border: `1px solid ${alpha(customColors.primary.main, 0.3)}`,
          ...animations.float,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          ...glassStyle,
          borderRadius: '8px',
          fontSize: '0.875rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          ...glassStyle,
          borderRadius: '12px',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase': {
            '&.Mui-checked': {
              '& + .MuiSwitch-track': {
                background: customColors.primary.gradient,
              },
            },
          },
        },
      },
    },
  },
});

// エクスポート
export default futuristicTheme;
export { customColors };
