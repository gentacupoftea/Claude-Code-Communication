import React from 'react';
import { Container } from '@mui/material';

export const mainLayout = (Component: React.ComponentType) => {
  return (props: any) => (
    <Container maxWidth={false} sx={{ px: 3, py: 3 }}>
      <Component {...props} />
    </Container>
  );
};