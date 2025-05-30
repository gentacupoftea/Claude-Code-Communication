'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Box,
  Stack,
  IconButton,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Edit, Check, X } from 'lucide-react';

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
  },
}));

const MetricBox = styled(Box)(({ theme }) => ({
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: '#f5f5f5',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  '&:hover': {
    backgroundColor: '#e8f5e9',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    fontSize: '14px',
  },
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': {
      borderColor: '#34d399',
    },
  },
}));

interface ProductMetricsCardProps {
  id: string;
  productName: string;
  productImage?: string;
  sales: number;
  views: number;
  orders: number;
  onUpdate?: (id: string, field: string, value: number) => void;
}

export const ProductMetricsCard: React.FC<ProductMetricsCardProps> = ({
  id,
  productName,
  productImage,
  sales,
  views,
  orders,
  onUpdate,
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState({
    sales,
    views,
    orders,
  });

  const handleEdit = (field: string) => {
    setEditingField(field);
  };

  const handleSave = (field: string) => {
    if (onUpdate) {
      onUpdate(id, field, tempValues[field as keyof typeof tempValues]);
    }
    setEditingField(null);
  };

  const handleCancel = (field: string) => {
    setTempValues({
      ...tempValues,
      [field]: field === 'sales' ? sales : field === 'views' ? views : orders,
    });
    setEditingField(null);
  };

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setTempValues({
      ...tempValues,
      [field]: numValue,
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('ja-JP');
  };

  const renderMetric = (label: string, field: string, value: number, unit: string) => {
    const isEditing = editingField === field;

    return (
      <MetricBox onClick={() => !isEditing && handleEdit(field)}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        {isEditing ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <StyledTextField
              size="small"
              type="number"
              value={tempValues[field as keyof typeof tempValues]}
              onChange={(e) => handleChange(field, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              fullWidth
            />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleSave(field);
              }}
              sx={{ color: '#34d399' }}
            >
              <Check size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(field);
              }}
              sx={{ color: '#ef4444' }}
            >
              <X size={16} />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#34d399' }}>
              {formatNumber(value)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {unit}
            </Typography>
          </Stack>
        )}
      </MetricBox>
    );
  };

  return (
    <StyledCard>
      <CardMedia
        component="img"
        height="200"
        image={productImage || `https://via.placeholder.com/400x200/34d399/ffffff?text=${encodeURIComponent(productName)}`}
        alt={productName}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 600 }}>
          {productName}
        </Typography>
        <Stack spacing={2}>
          {renderMetric('売上', 'sales', tempValues.sales, '円')}
          {renderMetric('アクセス数', 'views', tempValues.views, '回')}
          {renderMetric('注文件数', 'orders', tempValues.orders, '件')}
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Chip
            label="クリックして編集"
            size="small"
            sx={{
              backgroundColor: '#e8f5e9',
              color: '#34d399',
              fontSize: '12px',
            }}
          />
        </Box>
      </CardContent>
    </StyledCard>
  );
};

export default ProductMetricsCard;