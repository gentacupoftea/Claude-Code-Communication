import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Avatar } from '@mui/material';
import { formatCurrency } from '../../../utils/format';

interface Product {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  image?: string;
}

interface TopProductsProps {
  products: Product[];
}

export const TopProducts: React.FC<TopProductsProps> = ({ products }) => {
  return (
    <Box>
      <List>
        {products.map((product, index) => (
          <ListItem key={product.id} divider={index < products.length - 1}>
            <Avatar
              sx={{ mr: 2, width: 48, height: 48 }}
              src={product.image}
              variant="rounded"
            >
              {!product.image && product.name[0]}
            </Avatar>
            <ListItemText
              primary={product.name}
              secondary={`${product.sales} sold`}
            />
            <Typography variant="body1" fontWeight="bold">
              {formatCurrency(product.revenue)}
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};