/**
 * カスタムボタンコンポーネント
 * MUIのButtonをラップして独自のスタイリングを適用
 */
import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface ButtonProps extends Omit<MuiButtonProps, 'size' | 'variant'> {
  variant?: 'primary' | 'secondary' | 'text' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  rounded?: boolean;
  gradient?: boolean;
  fullWidth?: boolean;
}

const StyledButton = styled(MuiButton)<{
  rounded?: boolean;
  gradient?: boolean;
  buttonVariant?: string;
}>(({ theme, rounded, gradient, buttonVariant }) => ({
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: rounded ? '50px' : theme.shape.borderRadius,
  transition: 'all 0.2s ease-in-out',
  
  ...(gradient && buttonVariant === 'primary' && {
    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
  }),
  
  ...(gradient && buttonVariant === 'secondary' && {
    background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.light} 90%)`,
    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
  }),
  
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: theme.shadows[4],
  },
  
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: theme.shadows[1],
  },
  
  '&:disabled': {
    transform: 'none',
    boxShadow: 'none',
  },
}));

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  rounded = false,
  gradient = false,
  fullWidth = false,
  children,
  disabled,
  ...props
}) => {
  const muiVariant = variant === 'primary' || variant === 'secondary' ? 'contained' : variant;
  const muiColor = variant === 'primary' || variant === 'secondary' ? variant : 'inherit';
  
  return (
    <StyledButton
      variant={muiVariant}
      color={muiColor}
      size={size}
      disabled={disabled || loading}
      startIcon={!loading && icon}
      fullWidth={fullWidth}
      rounded={rounded}
      gradient={gradient}
      buttonVariant={variant}
      {...props}
    >
      {loading ? (
        <CircularProgress size={20} color="inherit" />
      ) : (
        children
      )}
    </StyledButton>
  );
};

export default Button;