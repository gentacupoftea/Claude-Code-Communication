'use client';

import React, { useState } from 'react';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { CanvasEditor } from '@/components/CanvasEditor';
import { ProductMetricsCard } from '@/components/ProductMetricsCard';
import { Container, Typography, Grid, Box, Paper, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import dayjs, { Dayjs } from 'dayjs';

const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: '40px',
  paddingBottom: '40px',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  marginBottom: '24px',
  fontWeight: 600,
  color: '#333',
}));

const SectionPaper = styled(Paper)(({ theme }) => ({
  padding: '32px',
  marginBottom: '40px',
  borderRadius: '16px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#34d399',
  color: 'white',
  borderRadius: '8px',
  textTransform: 'none',
  '&:hover': {
    backgroundColor: '#2fb383',
  },
}));

interface ProductData {
  id: string;
  productName: string;
  sales: number;
  views: number;
  orders: number;
}

export default function DemoPage() {
  const [dateRange, setDateRange] = useState<{
    start: Dayjs | null;
    end: Dayjs | null;
  }>({
    start: dayjs().subtract(7, 'day'),
    end: dayjs(),
  });

  const [products, setProducts] = useState<ProductData[]>([
    {
      id: '1',
      productName: 'スマートウォッチ Pro',
      sales: 1250000,
      views: 45320,
      orders: 256,
    },
    {
      id: '2',
      productName: 'ワイヤレスイヤホン Air',
      sales: 890000,
      views: 38900,
      orders: 445,
    },
    {
      id: '3',
      productName: 'ポータブル充電器 Max',
      sales: 560000,
      views: 29100,
      orders: 380,
    },
    {
      id: '4',
      productName: 'スマートスピーカー Home',
      sales: 2100000,
      views: 62400,
      orders: 420,
    },
  ]);

  const handleDateRangeChange = (start: Dayjs | null, end: Dayjs | null) => {
    setDateRange({ start, end });
    console.log('選択された期間:', {
      start: start?.format('YYYY-MM-DD'),
      end: end?.format('YYYY-MM-DD'),
    });
  };

  const handleCanvasSave = (dataUrl: string) => {
    console.log('キャンバスが保存されました');
  };

  const handleProductUpdate = (id: string, field: string, value: number) => {
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === id ? { ...product, [field]: value } : product
      )
    );
    console.log(`商品 ${id} の ${field} が ${value} に更新されました`);
  };

  return (
    <StyledContainer maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#34d399' }}>
          Conea コンポーネントデモ
        </Typography>
        <Link href="/dashboard" passHref style={{ textDecoration: 'none' }}>
          <ActionButton variant="contained" endIcon={<ArrowRight size={20} />}>
            ダッシュボードを試す
          </ActionButton>
        </Link>
      </Box>

      {/* DateRangeSelector Section */}
      <SectionPaper elevation={0}>
        <SectionTitle variant="h4">DateRangeSelector</SectionTitle>
        <Typography variant="body1" color="text.secondary" paragraph>
          日付範囲を選択するコンポーネントです。開始日と終了日を選択でき、Coneaブランドカラーでスタイリングされています。
          ダッシュボードではフィルターコンポーネントとして利用できます。
        </Typography>
        <Box sx={{ mt: 3 }}>
          <DateRangeSelector
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={handleDateRangeChange}
          />
        </Box>
        <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <Typography variant="body2" color="text.secondary">
            選択された期間: {dateRange.start?.format('YYYY年MM月DD日') || '未選択'} 〜{' '}
            {dateRange.end?.format('YYYY年MM月DD日') || '未選択'}
          </Typography>
        </Box>
      </SectionPaper>

      {/* CanvasEditor Section */}
      <SectionPaper elevation={0}>
        <SectionTitle variant="h4">CanvasEditor</SectionTitle>
        <Typography variant="body1" color="text.secondary" paragraph>
          テキストや図形を追加できるキャンバスエディターです。作成した内容は画像として保存できます。
          ダッシュボードではカスタムウィジェットとして追加できます。
        </Typography>
        <Box sx={{ mt: 3 }}>
          <CanvasEditor
            width={800}
            height={400}
            backgroundColor="#f9fafb"
            onSave={handleCanvasSave}
          />
        </Box>
      </SectionPaper>

      {/* ProductMetricsCard Section */}
      <SectionPaper elevation={0}>
        <SectionTitle variant="h4">ProductMetricsCard</SectionTitle>
        <Typography variant="body1" color="text.secondary" paragraph>
          商品の売上、アクセス数、注文件数を表示・編集できるカードコンポーネントです。
          各メトリクスをクリックすると編集モードになります。
          ダッシュボードではカスタムウィジェットとして複数商品の表示が可能です。
        </Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {products.map((product) => (
            <Grid item xs={12} sm={6} md={3} key={product.id}>
              <ProductMetricsCard
                id={product.id}
                productName={product.productName}
                sales={product.sales}
                views={product.views}
                orders={product.orders}
                onUpdate={handleProductUpdate}
              />
            </Grid>
          ))}
        </Grid>
      </SectionPaper>

      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          これらのコンポーネントをダッシュボードで使ってみましょう
        </Typography>
        <Link href="/dashboard" passHref style={{ textDecoration: 'none' }}>
          <ActionButton variant="contained" size="large" endIcon={<ArrowRight size={24} />} sx={{ mt: 2 }}>
            ダッシュボードへ移動
          </ActionButton>
        </Link>
      </Box>
    </StyledContainer>
  );
}