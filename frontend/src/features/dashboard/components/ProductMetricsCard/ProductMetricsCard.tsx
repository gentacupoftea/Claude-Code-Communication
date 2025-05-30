import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Stack,
  TextField,
  IconButton,
  Skeleton,
  Chip,
  LinearProgress,
} from '@mui/material';
import { 
  Edit, 
  Check, 
  Close,
  TrendingUp,
  TrendingDown,
  RemoveRedEye,
  ShoppingCart,
  AttachMoney,
  AutoGraph,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductMetric {
  label: string;
  value: number;
  unit: string;
  key: 'sales' | 'views' | 'orders';
  icon: React.ReactNode;
  color: string;
  trend?: number;
}

interface ProductMetricsCardProps {
  productName: string;
  productImage?: string;
  sales: number;
  views: number;
  orders: number;
  onMetricUpdate?: (key: 'sales' | 'views' | 'orders', value: number) => void;
}

export const ProductMetricsCard: React.FC<ProductMetricsCardProps> = ({
  productName,
  productImage,
  sales,
  views,
  orders,
  onMetricUpdate,
}) => {
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState({
    sales,
    views,
    orders,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const metrics: ProductMetric[] = [
    { 
      label: '売上', 
      value: tempValues.sales, 
      unit: '円', 
      key: 'sales',
      icon: <AttachMoney />,
      color: '#00ff88',
      trend: 12.5,
    },
    { 
      label: 'アクセス数', 
      value: tempValues.views, 
      unit: '回', 
      key: 'views',
      icon: <RemoveRedEye />,
      color: '#00aaff',
      trend: -3.2,
    },
    { 
      label: '注文件数', 
      value: tempValues.orders, 
      unit: '件', 
      key: 'orders',
      icon: <ShoppingCart />,
      color: '#ff0088',
      trend: 8.7,
    },
  ];

  const formatNumber = (num: number, unit: string): string => {
    if (unit === '円') {
      if (num >= 1000000) {
        return `¥${(num / 1000000).toFixed(1)}M`;
      } else if (num >= 1000) {
        return `¥${(num / 1000).toFixed(0)}K`;
      }
      return `¥${num.toLocaleString('ja-JP')}`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K${unit}`;
    }
    return `${num.toLocaleString('ja-JP')}${unit}`;
  };

  const handleEdit = (key: string) => {
    setEditingMetric(key);
  };

  const handleSave = (key: 'sales' | 'views' | 'orders') => {
    if (onMetricUpdate) {
      onMetricUpdate(key, tempValues[key]);
    }
    setEditingMetric(null);
  };

  const handleCancel = (key: 'sales' | 'views' | 'orders') => {
    setTempValues({
      ...tempValues,
      [key]: key === 'sales' ? sales : key === 'views' ? views : orders,
    });
    setEditingMetric(null);
  };

  const handleChange = (key: 'sales' | 'views' | 'orders', value: string) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setTempValues({
      ...tempValues,
      [key]: numValue,
    });
  };

  const conversionRate = orders > 0 && views > 0 ? ((orders / views) * 100).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -8 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            border: '1px solid rgba(0, 255, 136, 0.3)',
            boxShadow: '0 24px 48px rgba(0, 255, 136, 0.2)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(0, 255, 136, 0.1) 0%, transparent 50%)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', overflow: 'hidden', height: 240 }}>
          {productImage ? (
            <>
              {!imageLoaded && (
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height={240}
                  sx={{ position: 'absolute', top: 0, left: 0 }}
                />
              )}
              <CardMedia
                component="img"
                height="240"
                image={productImage}
                alt={productName}
                onLoad={() => setImageLoaded(true)}
                sx={{ 
                  objectFit: 'cover',
                  transition: 'transform 0.3s ease',
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  opacity: imageLoaded ? 1 : 0,
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                height: 240,
                background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(255, 0, 136, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoGraph sx={{ fontSize: 64, color: 'rgba(255, 255, 255, 0.3)' }} />
            </Box>
          )}
          
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              gap: 1,
            }}
          >
            <Chip
              label={`CV ${conversionRate}%`}
              size="small"
              sx={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(10px)',
                color: '#00ff88',
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>

        <CardContent sx={{ flexGrow: 1, p: 3 }}>
          <Typography
            variant="h6"
            component="h3"
            gutterBottom
            sx={{
              fontWeight: 700,
              mb: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {productName}
          </Typography>

          <Stack spacing={2}>
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box
                  sx={{
                    p: 2,
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: editingMetric === metric.key ? metric.color : 'rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `linear-gradient(90deg, transparent 0%, ${metric.color}22 50%, transparent 100%)`,
                      transform: editingMetric === metric.key ? 'translateX(0)' : 'translateX(-100%)',
                      transition: 'transform 0.3s ease',
                    },
                  }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ color: metric.color }}>{metric.icon}</Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {metric.label}
                        </Typography>
                        {metric.trend && (
                          <Chip
                            size="small"
                            icon={metric.trend > 0 ? <TrendingUp /> : <TrendingDown />}
                            label={`${metric.trend > 0 ? '+' : ''}${metric.trend}%`}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: metric.trend > 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 51, 102, 0.2)',
                              color: metric.trend > 0 ? '#00ff88' : '#ff3366',
                              '& .MuiChip-icon': {
                                fontSize: 14,
                                color: metric.trend > 0 ? '#00ff88' : '#ff3366',
                              },
                            }}
                          />
                        )}
                      </Stack>
                      
                      {editingMetric === metric.key ? (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => handleSave(metric.key)}
                            sx={{ color: '#00ff88' }}
                          >
                            <Check fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(metric.key)}
                            sx={{ color: '#ff3366' }}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(metric.key)}
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            color: metric.color,
                            '.MuiCard-root:hover &': {
                              opacity: 1,
                            },
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>

                    {editingMetric === metric.key ? (
                      <TextField
                        fullWidth
                        size="small"
                        value={tempValues[metric.key]}
                        onChange={(e) => handleChange(metric.key, e.target.value)}
                        autoFocus
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: metric.color,
                          },
                        }}
                      />
                    ) : (
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: metric.color,
                          textShadow: `0 0 20px ${metric.color}66`,
                        }}
                      >
                        {formatNumber(metric.value, metric.unit)}
                      </Typography>
                    )}
                  </Stack>
                  
                  <LinearProgress
                    variant="determinate"
                    value={metric.key === 'sales' ? 75 : metric.key === 'views' ? 60 : 45}
                    sx={{
                      mt: 1,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: metric.color,
                        boxShadow: `0 0 10px ${metric.color}`,
                      },
                    }}
                  />
                </Box>
              </motion.div>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );
};