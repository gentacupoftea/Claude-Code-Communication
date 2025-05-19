/**
 * カスタム入力フィールドコンポーネント
 * Material-UIのTextFieldをラップし、統一されたスタイリングを提供
 */
import React from 'react';
import { TextField, TextFieldProps, InputAdornment } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface InputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'standard' | 'filled' | 'outlined';
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['border-color', 'box-shadow'], {
      duration: theme.transitions.duration.short,
    }),
  },
  '& .MuiOutlinedInput-root': {
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderWidth: 2,
    },
  },
  '& .MuiFilledInput-root': {
    borderRadius: theme.shape.borderRadius,
    '&:before': {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    '&:hover:before': {
      borderBottom: `2px solid ${theme.palette.primary.main}`,
    },
    '&.Mui-focused': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

export const Input: React.FC<InputProps> = React.forwardRef(
  ({ variant = 'outlined', startIcon, endIcon, InputProps = {}, ...props }, ref) => {
    const inputProps = {
      ...InputProps,
      startAdornment: startIcon ? (
        <InputAdornment position="start">{startIcon}</InputAdornment>
      ) : InputProps.startAdornment,
      endAdornment: endIcon ? (
        <InputAdornment position="end">{endIcon}</InputAdornment>
      ) : InputProps.endAdornment,
    };

    return (
      <StyledTextField
        ref={ref}
        variant={variant}
        fullWidth
        InputProps={inputProps}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;