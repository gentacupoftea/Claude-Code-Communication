/**
 * メトリクスカードコンポーネント
 * 数値やパーセンテージなどの指標を表示するカード
 */
import React from 'react';
import { Typography, Box, IconButton, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat, Info } from '@mui/icons-material';
import { Card } from '../../atoms';
import { formatNumber, formatPercent } from '../../utils/format';

export interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  format?: 'number' | 'currency' | 'percent';
  currency?: string;
  info?: string;
  onClick?: () => void;
}

const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
  switch (direction) {
    case 'up':
      return <TrendingUp />;
    case 'down':
      return <TrendingDown />;
    default:
      return <TrendingFlat />;
  }
};

const getTrendColor = (direction: 'up' | 'down' | 'neutral', isPositiveGood = true) => {
  if (direction === 'neutral') return 'text.secondary';
  
  const isPositive = direction === 'up';
  return (isPositive && isPositiveGood) || (!isPositive && !isPositiveGood)
    ? 'success.main'
    : 'error.main';
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  format = 'number',
  currency = 'JPY',
  info,
  onClick,
}) => {
  const formatValue = () => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percent':
        return formatPercent(value);
      default:
        return formatNumber(value);
    }
  };

  return (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClick}
    >
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {info && (
            <Tooltip title={info}>
              <IconButton size="small">
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        <Typography variant="h4" component="div" sx={{ mb: 1, fontWeight: 600 }}>
          {formatValue()}
        </Typography>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: getTrendColor(trend.direction),
              }}
            >
              {getTrendIcon(trend.direction)}
              <Typography variant="body2" sx={{ ml: 0.5 }}>
                {formatPercent(Math.abs(trend.value))}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default MetricCard;