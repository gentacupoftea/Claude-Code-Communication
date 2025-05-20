/**
 * レポートページ
 * 各種レポートの生成と管理
 */
import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Paper,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  CalendarToday,
  Download,
  Schedule,
  Description,
  PictureAsPdf,
  TableChart,
  Assessment,
  TrendingUp,
  Email,
  CloudDownload,
  Delete,
  Edit,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { MetricCard } from '../../molecules';
import { ECPlatform } from '../../types';

interface Report {
  id: string;
  name: string;
  type: 'sales' | 'inventory' | 'customer' | 'seo' | 'custom';
  platforms: ECPlatform[];
  dateRange: { start: Date; end: Date };
  format: 'pdf' | 'excel' | 'csv';
  status: 'completed' | 'processing' | 'scheduled' | 'failed';
  createdAt: Date;
  fileSize?: number;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRun: Date;
  };
}

const ReportsComponent: React.FC = () => {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState('sales');
  const [platforms, setPlatforms] = useState<ECPlatform[]>([]);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [format, setFormat] = useState('pdf');
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const reports: Report[] = [
    {
      id: '1',
      name: '月次売上レポート - 2024年1月',
      type: 'sales',
      platforms: ['shopify', 'rakuten', 'amazon'],
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      format: 'pdf',
      status: 'completed',
      createdAt: new Date('2024-02-01'),
      fileSize: 2.5,
    },
    {
      id: '2',
      name: '在庫分析レポート',
      type: 'inventory',
      platforms: ['shopify'],
      dateRange: { start: new Date('2024-01-15'), end: new Date('2024-01-15') },
      format: 'excel',
      status: 'processing',
      createdAt: new Date(),
    },
    {
      id: '3',
      name: '顧客分析レポート（定期）',
      type: 'customer',
      platforms: ['shopify', 'rakuten'],
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      format: 'csv',
      status: 'scheduled',
      createdAt: new Date('2024-01-01'),
      schedule: {
        frequency: 'monthly',
        nextRun: new Date('2024-02-01'),
      },
    },
  ];

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'sales':
        return <TrendingUp />;
      case 'inventory':
        return <Assessment />;
      case 'customer':
        return <People />;
      case 'seo':
        return <Language />;
      default:
        return <Description />;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <PictureAsPdf />;
      case 'excel':
        return <TableChart />;
      case 'csv':
        return <TableChart />;
      default:
        return <Description />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'scheduled':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleGenerateReport = () => {
    // レポート生成ロジック
    console.log('Generating report:', { reportType, platforms, dateRange, format });
  };

  const handleScheduleReport = () => {
    setScheduleDialog(true);
  };

  const handleDownloadReport = (report: Report) => {
    // レポートダウンロードロジック
    console.log('Downloading report:', report);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('reports.title')}
        </Typography>
        <Typography color="text.secondary">
          {t('reports.description')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* レポート生成フォーム */}
        <Grid item xs={12} md={8}>
          <Card title={t('reports.generate')}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('reports.type')}</InputLabel>
                  <Select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    label={t('reports.type')}
                  >
                    <MenuItem value="sales">{t('reports.sales')}</MenuItem>
                    <MenuItem value="inventory">{t('reports.inventory')}</MenuItem>
                    <MenuItem value="customer">{t('reports.customers')}</MenuItem>
                    <MenuItem value="seo">SEO分析</MenuItem>
                    <MenuItem value="custom">カスタム</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('reports.platform')}</InputLabel>
                  <Select
                    multiple
                    value={platforms}
                    onChange={(e) => setPlatforms(e.target.value as ECPlatform[])}
                    label={t('reports.platform')}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="shopify">Shopify</MenuItem>
                    <MenuItem value="rakuten">楽天</MenuItem>
                    <MenuItem value="amazon">Amazon</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('reports.startDate')}
                  type="date"
                  value={dateRange.start.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('reports.endDate')}
                  type="date"
                  value={dateRange.end.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('reports.format')}</InputLabel>
                  <Select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    label={t('reports.format')}
                  >
                    <MenuItem value="pdf">PDF</MenuItem>
                    <MenuItem value="excel">Excel</MenuItem>
                    <MenuItem value="csv">CSV</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleGenerateReport}
                    startIcon={<CloudDownload />}
                  >
                    {t('reports.generate')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleScheduleReport}
                    startIcon={<Schedule />}
                  >
                    {t('reports.schedule')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        {/* レポート統計 */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <MetricCard
                title={t('reports.totalGenerated')}
                value={reports.length}
                subtitle={t('reports.thisMonth')}
                trend={{ value: 12, direction: 'up' }}
              />
            </Grid>
            <Grid item xs={12}>
              <MetricCard
                title={t('reports.scheduled')}
                value={reports.filter(r => r.status === 'scheduled').length}
                subtitle={t('reports.active')}
              />
            </Grid>
            <Grid item xs={12}>
              <MetricCard
                title={t('reports.processing')}
                value={reports.filter(r => r.status === 'processing').length}
                subtitle={t('reports.inProgress')}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* レポート履歴 */}
        <Grid item xs={12}>
          <Card title={t('reports.history')}>
            <List>
              {reports.map((report) => (
                <ListItem key={report.id} divider>
                  <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                    {getReportIcon(report.type)}
                  </Avatar>
                  <ListItemText
                    primary={report.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">
                          {report.createdAt.toLocaleDateString()} • {' '}
                          {report.platforms.join(', ')} • {' '}
                          {report.format.toUpperCase()}
                        </Typography>
                        {report.fileSize && (
                          <Typography variant="body2" component="span">
                            {' • '}{report.fileSize} MB
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <Chip
                    label={t(`reports.status.${report.status}`)}
                    color={getStatusColor(report.status)}
                    size="small"
                    sx={{ mr: 2 }}
                  />
                  {report.status === 'completed' && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDownloadReport(report)}
                      >
                        <Download />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                  {report.status === 'processing' && (
                    <ListItemSecondaryAction>
                      <LinearProgress
                        variant="indeterminate"
                        sx={{ width: 100 }}
                      />
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>

      {/* スケジュール設定ダイアログ */}
      <Dialog
        open={scheduleDialog}
        onClose={() => setScheduleDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('reports.scheduleSettings')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('reports.frequency')}</InputLabel>
                <Select label={t('reports.frequency')}>
                  <MenuItem value="daily">毎日</MenuItem>
                  <MenuItem value="weekly">毎週</MenuItem>
                  <MenuItem value="monthly">毎月</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('reports.recipients')}
                placeholder="email@example.com"
                helperText="複数のメールアドレスはカンマで区切ってください"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => setScheduleDialog(false)}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// 不足しているアイコンのインポート
import { People, Language } from '@mui/icons-material';

export const Reports = mainLayout(ReportsComponent);