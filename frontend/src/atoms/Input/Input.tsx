/**
 * カスタム入力フィールドコンポーネント
 * MUIのTextFieldをラップして独自のスタイリングを適用
 */
import React from 'react';
import { TextField, TextFieldProps, InputAdornment } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface InputProps extends Omit<TextFieldProps, 'size'> {
  size?: 'small' | 'medium';
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  rounded?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

const StyledTextField = styled(TextField)<{ rounded?: boolean }>(({ theme, rounded }) => ({
  '& .MuiInputBase-root': {
    borderRadius: rounded ? '50px' : theme.shape.borderRadius,
    transition: 'all 0.2s ease-in-out',
    
    '&:hover': {
      transform: 'translateY(-1px)',
    },
    
    '&.Mui-focused': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
  },
  
  '& .MuiOutlinedInput-notchedOutline': {
    transition: 'border-color 0.2s ease-in-out',
  },
}));

const Input = React.forwardRef<HTMLDivElement, InputProps>(({
  size = 'medium',
  icon,
  iconPosition = 'start',
  rounded = false,
  fullWidth = true,
  startIcon,
  endIcon,
  InputProps,
  ...props
}, ref) => {
  const adornments = {
    ...InputProps,
    ...(icon && {
      [iconPosition === 'start' ? 'startAdornment' : 'endAdornment']: (
        <InputAdornment position={iconPosition}>{icon}</InputAdornment>
      ),
    }),
    ...(startIcon && {
      startAdornment: <InputAdornment position="start">{startIcon}</InputAdornment>,
    }),
    ...(endIcon && {
      endAdornment: <InputAdornment position="end">{endIcon}</InputAdornment>,
    }),
  };

  return (
    <StyledTextField
      ref={ref}
      size={size}
      fullWidth={fullWidth}
      rounded={rounded}
      InputProps={adornments}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
export default Input;