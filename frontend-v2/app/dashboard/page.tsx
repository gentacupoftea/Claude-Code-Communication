'use client';

import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Fab,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Plus } from 'lucide-react';
import { WidgetSelector } from '@/components/WidgetSelector';
import { WidgetRenderer } from '@/components/WidgetRenderer';
import { useDashboardStore } from '@/store/dashboardStore';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: '24px',
  paddingBottom: '24px',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
}));

const DashboardHeader = styled(Box)(({ theme }) => ({
  marginBottom: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  padding: '80px 40px',
  textAlign: 'center',
  borderRadius: '16px',
  backgroundColor: 'white',
  border: '2px dashed #e0e0e0',
}));

const StyledFab = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  backgroundColor: '#34d399',
  color: 'white',
  '&:hover': {
    backgroundColor: '#2fb383',
  },
}));

export default function DashboardPage() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { widgets, removeWidget, updateGridLayout } = useDashboardStore();

  const handleLayoutChange = (layout: any[]) => {
    updateGridLayout(layout);
  };

  const generateLayout = () => {
    return widgets.map((widget, index) => ({
      i: widget.id,
      x: widget.layout?.x || (index % 3) * 4,
      y: widget.layout?.y || Math.floor(index / 3) * 3,
      w: widget.layout?.w || 4,
      h: widget.layout?.h || 3,
      minW: 2,
      minH: 2,
    }));
  };

  return (
    <StyledContainer maxWidth="xl">
      <DashboardHeader>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
            ダッシュボード
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            グラフやウィジェットを追加してカスタマイズしましょう
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={() => setSelectorOpen(true)}
          sx={{
            backgroundColor: '#34d399',
            '&:hover': {
              backgroundColor: '#2fb383',
            },
            borderRadius: '8px',
            textTransform: 'none',
          }}
        >
          ウィジェットを追加
        </Button>
      </DashboardHeader>

      {widgets.length === 0 ? (
        <EmptyState elevation={0}>
          <Box sx={{ mb: 3 }}>
            <Plus size={48} color="#34d399" />
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            ウィジェットを追加してダッシュボードを作成
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            グラフ、メトリクス、カスタムコンポーネントを組み合わせて
            <br />
            あなただけのダッシュボードを作成できます
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Plus size={20} />}
            onClick={() => setSelectorOpen(true)}
            sx={{
              backgroundColor: '#34d399',
              '&:hover': {
                backgroundColor: '#2fb383',
              },
              borderRadius: '8px',
              textTransform: 'none',
            }}
          >
            最初のウィジェットを追加
          </Button>
        </EmptyState>
      ) : (
        <GridLayout
          className="layout"
          layout={generateLayout()}
          cols={12}
          rowHeight={80}
          width={1200}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-header"
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <WidgetRenderer widget={widget} />
            </div>
          ))}
        </GridLayout>
      )}

      {widgets.length > 0 && (
        <StyledFab onClick={() => setSelectorOpen(true)} aria-label="add widget">
          <Plus size={24} />
        </StyledFab>
      )}

      <WidgetSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} />
    </StyledContainer>
  );
}