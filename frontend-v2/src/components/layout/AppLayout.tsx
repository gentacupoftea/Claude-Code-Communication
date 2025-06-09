// frontend-v2/src/components/layout/AppLayout.tsx
import React from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, sidebar }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100vh' }}>
      <main style={{ overflowY: 'auto' }}>{children}</main>
      <aside style={{ borderLeft: '1px solid #ccc', overflowY: 'auto' }}>{sidebar}</aside>
    </div>
  );
};