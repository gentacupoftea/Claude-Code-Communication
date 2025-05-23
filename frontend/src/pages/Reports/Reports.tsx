/**
 * レポートページ
 * 各種レポートの生成と管理
 */
import React, { useState, useEffect } from 'react';
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
  Alert,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Tooltip,
  SelectChangeEvent,
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
  People,
  Language,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Send,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { MetricCard } from '../../molecules';
import { ECPlatform } from '../../types';
import axios from 'axios';

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
    recipients?: string[];
  };
  downloadUrl?: string;
  progress?: number;
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients: string[];
  enabled: boolean;
}

const ReportsComponent: React.FC = () => {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState('sales');
  const [platforms, setPlatforms] = useState<ECPlatform[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 30)), 
    end: new Date() 
  });
  const [format, setFormat] = useState('pdf');
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [reportName, setReportName] = useState('');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(false);
  const [schedule, setSchedule] = useState<ReportSchedule>({
    frequency: 'monthly',
    time: '09:00',
    recipients: [],
    enabled: true,
  });
  const [recipientEmail, setRecipientEmail] = useState('');
  const [reports, setReports] = useState<Report[]>([
  ]);

  // Load saved reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      // In production, this would load from API
      const savedReports = localStorage.getItem('reports');
      if (savedReports) {
        const parsedReports = JSON.parse(savedReports);
        setReports(parsedReports.map((r: any) => ({
          ...r,
          dateRange: {
            start: new Date(r.dateRange.start),
            end: new Date(r.dateRange.end),
          },
          createdAt: new Date(r.createdAt),
          schedule: r.schedule ? {
            ...r.schedule,
            nextRun: new Date(r.schedule.nextRun),
          } : undefined,
        })));
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

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

  const generateReportName = () => {
    const typeLabel = {
      sales: '売上',
      inventory: '在庫',
      customer: '顧客',
      seo: 'SEO',
      custom: 'カスタム',
    }[reportType];
    
    const startDate = dateRange.start.toLocaleDateString('ja-JP');
    const endDate = dateRange.end.toLocaleDateString('ja-JP');
    
    return `${typeLabel}レポート_${startDate}_${endDate}`;
  };

  const handleGenerateReport = async () => {
    if (platforms.length === 0) {
      setSnackbar({ open: true, message: 'プラットフォームを選択してください', severity: 'error' });
      return;
    }
    
    setGeneratingReport(true);
    
    const newReport: Report = {
      id: `report_${Date.now()}`,
      name: reportName || generateReportName(),
      type: reportType as any,
      platforms,
      dateRange,
      format: format as any,
      status: 'processing',
      createdAt: new Date(),
      progress: 0,
    };
    
    setReports(prev => [newReport, ...prev]);
    
    try {
      // Simulate report generation
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setReports(prev => prev.map(r => 
          r.id === newReport.id ? { ...r, progress: i } : r
        ));
      }
      
      // In production, this would be an API call
      // const response = await axios.post('/api/reports/generate', {
      //   type: reportType,
      //   platforms,
      //   dateRange,
      //   format,
      //   options: { includeCharts, includeRawData }
      // });
      
      const completedReport: Report = {
        ...newReport,
        status: 'completed',
        fileSize: Math.random() * 5 + 0.5,
        downloadUrl: '#',
      };
      
      setReports(prev => prev.map(r => 
        r.id === newReport.id ? completedReport : r
      ));
      
      // Save to localStorage
      const updatedReports = reports.map(r => 
        r.id === newReport.id ? completedReport : r
      );
      localStorage.setItem('reports', JSON.stringify([completedReport, ...reports]));
      
      setSnackbar({ open: true, message: 'レポートが生成されました', severity: 'success' });
    } catch (error) {
      setReports(prev => prev.map(r => 
        r.id === newReport.id ? { ...r, status: 'failed' } : r
      ));
      setSnackbar({ open: true, message: 'レポートの生成に失敗しました', severity: 'error' });
    } finally {
      setGeneratingReport(false);
      setReportName('');
    }
  };

  const handleScheduleReport = () => {
    if (platforms.length === 0) {
      setSnackbar({ open: true, message: 'プラットフォームを選択してください', severity: 'error' });
      return;
    }
    setScheduleDialog(true);
  };

  const handleSaveSchedule = async () => {
    if (schedule.recipients.length === 0) {
      setSnackbar({ open: true, message: '受信者を追加してください', severity: 'error' });
      return;
    }
    
    const newReport: Report = {
      id: `report_${Date.now()}`,
      name: `${generateReportName()} (定期)`,
      type: reportType as any,
      platforms,
      dateRange,
      format: format as any,
      status: 'scheduled',
      createdAt: new Date(),
      schedule: {
        frequency: schedule.frequency,
        nextRun: calculateNextRun(schedule),
        recipients: schedule.recipients,
      },
    };
    
    setReports(prev => [newReport, ...prev]);
    localStorage.setItem('reports', JSON.stringify([newReport, ...reports]));
    
    setScheduleDialog(false);
    setSnackbar({ open: true, message: 'スケジュールが設定されました', severity: 'success' });
  };

  const calculateNextRun = (schedule: ReportSchedule): Date => {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    return nextRun;
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      // In production, this would trigger actual download
      // window.open(report.downloadUrl, '_blank');
      setSnackbar({ open: true, message: 'ダウンロードを開始しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'ダウンロードに失敗しました', severity: 'error' });
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    
    try {
      setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
      
      const updatedReports = reports.filter(r => r.id !== reportToDelete.id);
      localStorage.setItem('reports', JSON.stringify(updatedReports));
      
      setSnackbar({ open: true, message: 'レポートを削除しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '削除に失敗しました', severity: 'error' });
    } finally {
      setDeleteDialog(false);
      setReportToDelete(null);
    }
  };

  const addRecipient = () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setSnackbar({ open: true, message: '正しいメールアドレスを入力してください', severity: 'error' });
      return;
    }
    
    setSchedule(prev => ({
      ...prev,
      recipients: [...prev.recipients, recipientEmail],
    }));
    setRecipientEmail('');
  };

  const removeRecipient = (email: string) => {
    setSchedule(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email),
    }));
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="レポート名"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder={generateReportName()}
                  helperText="空欄の場合は自動生成されます"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('reports.type')}</InputLabel>
                  <Select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    label={t('reports.type')}
                  >
                    <MenuItem value="sales">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUp fontSize="small" />
                        {t('reports.sales')}
                      </Box>
                    </MenuItem>
                    <MenuItem value="inventory">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Assessment fontSize="small" />
                        {t('reports.inventory')}
                      </Box>
                    </MenuItem>
                    <MenuItem value="customer">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <People fontSize="small" />
                        {t('reports.customers')}
                      </Box>
                    </MenuItem>
                    <MenuItem value="seo">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Language fontSize="small" />
                        SEO分析
                      </Box>
                    </MenuItem>
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
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeCharts}
                        onChange={(e) => setIncludeCharts(e.target.checked)}
                      />
                    }
                    label="グラフを含める"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeRawData}
                        onChange={(e) => setIncludeRawData(e.target.checked)}
                      />
                    }
                    label="生データを含める"
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleGenerateReport}
                    startIcon={generatingReport ? <CircularProgress size={20} color="inherit" /> : <CloudDownload />}
                    disabled={generatingReport}
                  >
                    {generatingReport ? '生成中...' : t('reports.generate')}
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
                value={reports.filter(r => r.status === 'completed').length}
                subtitle="完成済み"
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
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadReports}
              >
                更新
              </Button>
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
                  <ListItemSecondaryAction>
                    {report.status === 'completed' && (
                      <>
                        <IconButton
                          onClick={() => handleDownloadReport(report)}
                        >
                          <Download />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            setReportToDelete(report);
                            setDeleteDialog(true);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </>
                    )}
                    {report.status === 'processing' && (
                      <Box sx={{ width: 100 }}>
                        <LinearProgress
                          variant={report.progress !== undefined ? 'determinate' : 'indeterminate'}
                          value={report.progress}
                        />
                        {report.progress !== undefined && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {report.progress}%
                          </Typography>
                        )}
                      </Box>
                    )}
                    {report.status === 'scheduled' && (
                      <>
                        <IconButton
                          onClick={() => {
                            setSelectedReport(report);
                            setScheduleDialog(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            setReportToDelete(report);
                            setDeleteDialog(true);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </>
                    )}
                    {report.status === 'failed' && (
                      <IconButton
                        onClick={() => {
                          setReportToDelete(report);
                          setDeleteDialog(true);
                        }}
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>

      {/* スケジュール設定ダイアログ */}
      <Dialog
        open={scheduleDialog}
        onClose={() => {
          setScheduleDialog(false);
          setSelectedReport(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedReport ? 'スケジュールを編集' : t('reports.scheduleSettings')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('reports.frequency')}</InputLabel>
                <Select 
                  value={schedule.frequency}
                  onChange={(e) => setSchedule(prev => ({ ...prev, frequency: e.target.value as any }))}
                  label={t('reports.frequency')}
                >
                  <MenuItem value="daily">毎日</MenuItem>
                  <MenuItem value="weekly">毎週</MenuItem>
                  <MenuItem value="monthly">毎月</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="実行時刻"
                type="time"
                value={schedule.time}
                onChange={(e) => setSchedule(prev => ({ ...prev, time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                受信者
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="email@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={addRecipient}
                  startIcon={<Email />}
                >
                  追加
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {schedule.recipients.map(email => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => removeRecipient(email)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                次回実行: {calculateNextRun(schedule).toLocaleString()}
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setScheduleDialog(false);
            setSelectedReport(null);
          }}>
            {t('common.cancel')}
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveSchedule}
            startIcon={<Send />}
          >
            {selectedReport ? '更新' : 'スケジュールを設定'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialog}
        onClose={() => {
          setDeleteDialog(false);
          setReportToDelete(null);
        }}
      >
        <DialogTitle>レポートを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography>
            「{reportToDelete?.name}」を削除します。この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialog(false);
            setReportToDelete(null);
          }}>
            キャンセル
          </Button>
          <Button 
            onClick={handleDeleteReport} 
            color="error" 
            variant="contained"
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export const Reports = mainLayout(ReportsComponent);