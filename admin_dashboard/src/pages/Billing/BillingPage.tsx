/**
 * Billing Page - 課金・請求ページ
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

const BillingPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Billing & Invoices
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Billing management dashboard coming soon...
      </Typography>
    </Box>
  );
};

export default BillingPage;