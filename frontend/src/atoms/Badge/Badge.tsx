/**
 * カスタムバッジコンポーネント
 * ステータスやカウントを表示するための小さなラベル
 */
import React from 'react';
import { Badge as MuiBadge, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface BadgeProps {
  variant?: 'dot' | 'standard' | 'status';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  value?: string | number;
  max?: number;
  size?: 'small' | 'medium' | 'large';
  children?: React.ReactNode;
}

const StatusChip = styled(Chip)<{ statusColor?: string }>(({ theme, statusColor }) => ({
  borderRadius: theme.shape.borderRadius * 3,
  height: 'auto',
  padding: theme.spacing(0.5, 1),
  fontSize: '0.75rem',
  fontWeight: 600,
  ...(statusColor && {
    backgroundColor: statusColor === 'primary' ? theme.palette.primary.light
      : statusColor === 'secondary' ? theme.palette.secondary.light
      : statusColor === 'success' ? theme.palette.success.light
      : statusColor === 'error' ? theme.palette.error.light
      : statusColor === 'warning' ? theme.palette.warning.light
      : statusColor === 'info' ? theme.palette.info.light
      : theme.palette.primary.light,
    color: statusColor === 'primary' ? theme.palette.primary.dark
      : statusColor === 'secondary' ? theme.palette.secondary.dark
      : statusColor === 'success' ? theme.palette.success.dark
      : statusColor === 'error' ? theme.palette.error.dark
      : statusColor === 'warning' ? theme.palette.warning.dark
      : statusColor === 'info' ? theme.palette.info.dark
      : theme.palette.primary.dark,
  }),
}));

export const Badge: React.FC<BadgeProps> = ({
  variant = 'standard',
  color = 'primary',
  value,
  max = 99,
  size = 'medium',
  children,
}) => {
  // ステータスバッジの場合
  if (variant === 'status') {
    return (
      <StatusChip
        label={value}
        size={size === 'small' ? 'small' : 'medium'}
        statusColor={color}
      />
    );
  }

  // 通常のバッジ（ドットまたは数字）
  const badgeContent = variant === 'dot' ? undefined : value;
  const displayValue = typeof badgeContent === 'number' && badgeContent > max 
    ? `${max}+` 
    : badgeContent;

  return (
    <MuiBadge
      badgeContent={displayValue}
      color={color}
      variant={variant === 'standard' ? 'standard' : 'dot'}
      max={max}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      sx={{
        '& .MuiBadge-badge': {
          fontSize: size === 'small' ? '0.625rem' : size === 'large' ? '0.875rem' : '0.75rem',
          height: size === 'small' ? 16 : size === 'large' ? 24 : 20,
          minWidth: size === 'small' ? 16 : size === 'large' ? 24 : 20,
        },
      }}
    >
      {children}
    </MuiBadge>
  );
};

export default Badge;