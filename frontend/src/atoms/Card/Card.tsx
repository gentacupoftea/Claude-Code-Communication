/**
 * カスタムカードコンポーネント
 * ダッシュボードで使用する統一されたカードデザイン
 */
import React from 'react';
import { Card as MuiCard, CardProps as MuiCardProps, CardContent, CardHeader, CardActions } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface CardProps extends Omit<MuiCardProps, 'children'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => prop !== 'variant' && prop !== 'padding',
})<Pick<CardProps, 'variant' | 'padding'>>(({ theme, variant = 'elevated', padding = 'medium' }) => {
  const variants = {
    elevated: {
      boxShadow: theme.shadows[2],
      '&:hover': {
        boxShadow: theme.shadows[4],
      },
    },
    outlined: {
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: 'none',
    },
    filled: {
      backgroundColor: theme.palette.background.default,
      boxShadow: 'none',
    },
  };

  const paddings = {
    none: 0,
    small: theme.spacing(1),
    medium: theme.spacing(2),
    large: theme.spacing(3),
  };

  return {
    borderRadius: theme.shape.borderRadius * 2,
    transition: theme.transitions.create(['box-shadow', 'transform'], {
      duration: theme.transitions.duration.short,
    }),
    ...variants[variant],
    '& .MuiCardContent-root': {
      padding: paddings[padding],
      '&:last-child': {
        paddingBottom: paddings[padding],
      },
    },
  };
});

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  children,
  variant = 'elevated',
  padding = 'medium',
  ...props
}) => {
  return (
    <StyledCard variant={variant} padding={padding} {...props}>
      {(title || subtitle || actions) && (
        <CardHeader
          title={title}
          subheader={subtitle}
          action={actions}
          sx={{
            '& .MuiCardHeader-title': {
              fontSize: '1.25rem',
              fontWeight: 600,
            },
            '& .MuiCardHeader-subheader': {
              fontSize: '0.875rem',
              opacity: 0.7,
            },
          }}
        />
      )}
      <CardContent>{children}</CardContent>
      {actions && <CardActions>{actions}</CardActions>}
    </StyledCard>
  );
};

export default Card;