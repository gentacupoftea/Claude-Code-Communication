/**
 * カスタムカードコンポーネント
 * MUIのCardをラップして独自のスタイリングを適用
 */
import React from 'react';
import { Card as MuiCard, CardContent, CardHeader, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface CardProps {
  title?: string;
  subtitle?: string;
  variant?: 'outlined' | 'elevated' | 'filled';
  children?: React.ReactNode;
  className?: string;
  shadow?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  fullHeight?: boolean;
  padding?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  sx?: any;
  actions?: React.ReactNode;
}

interface StyledCardProps {
  variant?: 'outlined' | 'elevated' | 'filled';
  shadow?: 'small' | 'medium' | 'large';
  fullHeight?: boolean;
  padding?: 'small' | 'medium' | 'large';
  interactive?: boolean;
}

const StyledCard = styled(MuiCard)<StyledCardProps>(({ theme, variant, shadow, fullHeight, padding, interactive }) => {
  const currentVariant: string = variant || 'outlined';
  const styles: any = {
    position: 'relative',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    height: fullHeight ? '100%' : 'auto',
    cursor: interactive ? 'pointer' : 'default',
  };

  if (padding === 'small') {
    styles['& .MuiCardContent-root'] = {
      padding: theme.spacing(1.5),
    };
  }

  if (padding === 'large') {
    styles['& .MuiCardContent-root'] = {
      padding: theme.spacing(3),
    };
  }

  if (interactive) {
    styles['&:hover'] = {
      transform: 'translateY(-2px)',
    };
  }

  if (shadow === 'small') {
    styles.boxShadow = theme.shadows[1];
  }

  if (shadow === 'medium') {
    styles.boxShadow = theme.shadows[3];
  }

  if (shadow === 'large') {
    styles.boxShadow = theme.shadows[6];
  }

  if (currentVariant === 'filled') {
    styles.backgroundColor = theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff';
  }

  return styles;
});

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  variant = 'outlined',
  children,
  className,
  shadow = 'medium',
  onClick,
  fullHeight = false,
  padding = 'medium',
  interactive = false,
  sx,
  actions,
}) => {
  return (
    <StyledCard
      className={className}
      sx={sx}
      elevation={variant === 'elevated' ? 3 : variant === 'filled' ? 0 : 1}
      onClick={onClick}
      fullHeight={fullHeight}
      interactive={interactive}
      shadow={shadow}
      padding={padding}
    >
      {title && (
        <CardHeader
          title={
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
          }
          subheader={subtitle}
          action={actions}
          sx={{ pb: 0 }}
        />
      )}
      <CardContent>
        {children}
      </CardContent>
    </StyledCard>
  );
};

export default Card;