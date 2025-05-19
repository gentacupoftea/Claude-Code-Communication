/**
 * カスタムボタンコンポーネント
 * Material-UIのButtonをラップし、統一されたスタイリングを提供
 */
import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  loading?: boolean;
  icon?: React.ReactNode;
}

const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop) => prop !== 'variant',
})<{ variant?: ButtonProps['variant'] }>(({ theme, variant }) => {
  const variants = {
    primary: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    secondary: {
      backgroundColor: theme.palette.secondary.main,
      color: theme.palette.secondary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.secondary.dark,
      },
    },
    danger: {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.error.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.error.dark,
      },
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.divider}`,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    link: {
      backgroundColor: 'transparent',
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      '&:hover': {
        textDecoration: 'none',
      },
    },
  };

  return {
    borderRadius: theme.shape.borderRadius,
    textTransform: 'none',
    transition: theme.transitions.create(['background-color', 'box-shadow', 'border', 'color'], {
      duration: theme.transitions.duration.short,
    }),
    ...(variant && variants[variant]),
  };
});

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  icon,
  children,
  disabled,
  startIcon,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant as any}
      disabled={disabled || loading}
      startIcon={
        loading ? (
          <CircularProgress size={16} color="inherit" />
        ) : icon || startIcon
      }
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button;