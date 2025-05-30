import React, { useEffect, useState } from 'react';
import { Widget } from '../../types';
import { useDataSource } from '../../hooks/useDataSource';
import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';

interface KPICardWidgetProps {
  widget: Widget;
}

export const KPICardWidget: React.FC<KPICardWidgetProps> = ({ widget }) => {
  const { data, loading, error } = useDataSource(widget.config.dataSource);
  const [kpiValue, setKpiValue] = useState<number>(0);
  const [previousValue, setPreviousValue] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');

  useEffect(() => {
    if (data && data.length > 0) {
      const measure = widget.config.measures[0];
      
      // 現在の値を計算
      const currentValue = data.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item[measure.field]) || 0);
      }, 0);
      
      setKpiValue(currentValue);
      
      // 前期比較（仮実装）
      if (data.length > 1) {
        const halfIndex = Math.floor(data.length / 2);
        const firstHalf = data.slice(0, halfIndex);
        const secondHalf = data.slice(halfIndex);
        
        const firstHalfSum = firstHalf.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item[measure.field]) || 0);
        }, 0);
        
        const secondHalfSum = secondHalf.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item[measure.field]) || 0);
        }, 0);
        
        setPreviousValue(firstHalfSum);
        
        if (secondHalfSum > firstHalfSum) {
          setTrend('up');
        } else if (secondHalfSum < firstHalfSum) {
          setTrend('down');
        } else {
          setTrend('flat');
        }
      }
    }
  }, [data, widget.config]);

  const formatValue = (value: number): string => {
    const format = widget.config.measures[0].format;
    
    if (format === 'currency') {
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
      }).format(value);
    } else if (format === 'percent') {
      return (value * 100).toFixed(1) + '%';
    } else {
      return new Intl.NumberFormat('ja-JP').format(value);
    }
  };

  const calculateChange = (): string => {
    if (previousValue === 0) return '0%';
    const change = ((kpiValue - previousValue) / previousValue) * 100;
    return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
  };

  if (loading) {
    return (
      <Box p={3}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" height={60} />
        <Skeleton variant="text" width="40%" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Typography color="error">エラー: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      p={3}
      height="100%"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      sx={{
        background: widget.config.styling?.backgroundColor || 'transparent',
      }}
    >
      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
        {widget.config.title}
      </Typography>
      
      <Typography
        variant="h3"
        component="div"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          fontSize: widget.config.styling?.fontSize || 32,
        }}
      >
        {formatValue(kpiValue)}
      </Typography>
      
      {previousValue > 0 && (
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            icon={
              trend === 'up' ? (
                <TrendingUp />
              ) : trend === 'down' ? (
                <TrendingDown />
              ) : (
                <TrendingFlat />
              )
            }
            label={calculateChange()}
            size="small"
            color={trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'default'}
            variant="outlined"
          />
          <Typography variant="caption" color="textSecondary">
            前期比
          </Typography>
        </Box>
      )}
    </Box>
  );
};