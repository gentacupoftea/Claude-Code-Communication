import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Avatar,
  Divider,
  Alert,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Assessment as ReportsIcon,
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  CloudDownload as DownloadIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  TrendingUp,
  TrendingDown,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  ShoppingCart as SalesIcon,
  Language as SeoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  DateRange as DateRangeIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  PlayArrow as RunIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface Report {
  id: string;
  name: string;
  type: 'sales' | 'inventory' | 'customer' | 'seo' | 'custom';
  description: string;
  platforms: string[];
  dateRange: { start: Date; end: Date };
  format: 'pdf' | 'excel' | 'csv';
  status: 'completed' | 'processing' | 'scheduled' | 'failed';
  createdAt: Date;
  fileSize?: number;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRun: Date;
    enabled: boolean;
  };
  lastRun?: Date;
  downloadCount?: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactElement;
  features: string[];
  platforms: string[];
  formats: string[];
}

const ReportsCenter: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Mock reports data
  const [reports] = useState<Report[]>([
    {
      id: '1',
      name: '月次売上レポート',
      type: 'sales',
      description: 'プラットフォーム別の売上分析レポート',
      platforms: ['Shopify', '楽天', 'Amazon'],
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      format: 'pdf',
      status: 'completed',
      createdAt: new Date('2024-02-01'),
      fileSize: 2.5,
      downloadCount: 15,
      lastRun: new Date('2024-02-01'),
    },
    {
      id: '2',
      name: '在庫分析レポート',
      type: 'inventory',
      description: '在庫レベルと回転率の詳細分析',
      platforms: ['Shopify'],
      dateRange: { start: new Date('2024-01-15'), end: new Date('2024-01-15') },
      format: 'excel',
      status: 'processing',
      createdAt: new Date(),
      schedule: {
        frequency: 'weekly',
        nextRun: new Date('2024-02-08'),
        enabled: true,
      },
    },
    {
      id: '3',
      name: '顧客行動分析',
      type: 'customer',
      description: '顧客セグメント別の購買パターン分析',
      platforms: ['Shopify', '楽天'],
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      format: 'csv',
      status: 'scheduled',
      createdAt: new Date('2024-01-01'),
      schedule: {
        frequency: 'monthly',
        nextRun: new Date('2024-03-01'),
        enabled: true,
      },
      downloadCount: 8,
    },
    {
      id: '4',
      name: 'SEOパフォーマンス',
      type: 'seo',
      description: '商品ページのSEO効果測定',
      platforms: ['Shopify'],
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      format: 'pdf',
      status: 'failed',
      createdAt: new Date('2024-01-28'),
    },
  ]);

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'sales-basic',
      name: '基本売上レポート',
      category: 'Sales',
      description: '売上高、注文数、平均注文額などの基本的な売上指標',
      icon: <SalesIcon />,
      features: ['売上トレンド', '商品別売上', 'プラットフォーム比較'],
      platforms: ['Shopify', '楽天', 'Amazon'],
      formats: ['PDF', 'Excel'],
    },
    {
      id: 'inventory-status',
      name: '在庫状況レポート',
      category: 'Inventory',
      description: '現在の在庫レベル、在庫切れリスク、回転率分析',
      icon: <InventoryIcon />,
      features: ['在庫レベル', '回転率', '在庫切れ予測'],
      platforms: ['Shopify', '楽天'],
      formats: ['Excel', 'CSV'],
    },
    {
      id: 'customer-insights',
      name: '顧客インサイト',
      category: 'Customer',
      description: '顧客セグメント、LTV、リピート率の詳細分析',
      icon: <PeopleIcon />,
      features: ['顧客セグメント', 'LTV分析', 'リピート率'],
      platforms: ['Shopify', '楽天', 'Amazon'],
      formats: ['PDF', 'Excel', 'CSV'],
    },
    {
      id: 'seo-performance',
      name: 'SEOパフォーマンス',
      category: 'SEO',
      description: '検索順位、トラフィック、コンバージョンのSEO分析',
      icon: <SeoIcon />,
      features: ['検索順位', 'オーガニック流入', 'キーワード分析'],
      platforms: ['Shopify'],
      formats: ['PDF'],
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckIcon color="success" />;
      case 'processing': return <RefreshIcon color="warning" />;
      case 'scheduled': return <ScheduleIcon color="info" />;
      case 'failed': return <ErrorIcon color="error" />;
      default: return <InfoIcon />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'scheduled': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sales': return <SalesIcon />;
      case 'inventory': return <InventoryIcon />;
      case 'customer': return <PeopleIcon />;
      case 'seo': return <SeoIcon />;
      default: return <DescriptionIcon />;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <PdfIcon />;
      case 'excel': return <ExcelIcon />;
      case 'csv': return <ExcelIcon />;
      default: return <DescriptionIcon />;
    }
  };

  // Sample chart data
  const salesData = [
    { month: 'Jan', sales: 4500, orders: 120 },
    { month: 'Feb', sales: 5200, orders: 135 },
    { month: 'Mar', sales: 4800, orders: 128 },
    { month: 'Apr', sales: 5800, orders: 145 },
    { month: 'May', sales: 6100, orders: 152 },
  ];

  const reportsData = [
    { type: 'Sales', count: 12, trend: 'up' },
    { type: 'Inventory', count: 8, trend: 'up' },
    { type: 'Customer', count: 6, trend: 'down' },
    { type: 'SEO', count: 4, trend: 'up' },
  ];

  const handleDownload = (report: Report) => {
    console.log('Downloading report:', report.id);
    // ダウンロード処理
  };

  const handleRunReport = (reportId: string) => {
    console.log('Running report:', reportId);
    // レポート実行処理
  };

  const handleNewReport = () => {
    setReportDialog(true);
    setCurrentStep(0);
  };

  const renderReportsList = () => (
    <Box>
      {/* レポート統計 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.primary.main, mx: 'auto', mb: 1 }}>
                <ReportsIcon />
              </Avatar>
              <Typography variant="h6">{reports.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                総レポート数
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.success.main, mx: 'auto', mb: 1 }}>
                <CheckIcon />
              </Avatar>
              <Typography variant="h6">
                {reports.filter(r => r.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                完了済み
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.info.main, mx: 'auto', mb: 1 }}>
                <ScheduleIcon />
              </Avatar>
              <Typography variant="h6">
                {reports.filter(r => r.schedule?.enabled).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                スケジュール済み
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.warning.main, mx: 'auto', mb: 1 }}>
                <RefreshIcon />
              </Avatar>
              <Typography variant="h6">
                {reports.filter(r => r.status === 'processing').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                処理中
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* レポート一覧 */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">レポート一覧</Typography>
            <Box display="flex" gap={1}>
              <Button startIcon={<FilterIcon />} size="small">
                フィルター
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNewReport}
              >
                新規作成
              </Button>
            </Box>
          </Box>
          
          <List>
            {reports.map((report, index) => (
              <React.Fragment key={report.id}>
                <ListItem>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      {getTypeIcon(report.type)}
                    </Avatar>
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">{report.name}</Typography>
                        <Chip
                          label={report.status}
                          color={getStatusColor(report.status)}
                          size="small"
                          icon={getStatusIcon(report.status)}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {report.description}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                          <Typography variant="caption">
                            📅 {report.dateRange.start.toLocaleDateString()} - {report.dateRange.end.toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption">
                            🏪 {report.platforms.join(', ')}
                          </Typography>
                          <Typography variant="caption">
                            📄 {report.format.toUpperCase()}
                          </Typography>
                          {report.fileSize && (
                            <Typography variant="caption">
                              📊 {report.fileSize}MB
                            </Typography>
                          )}
                        </Box>
                        {report.schedule?.enabled && (
                          <Typography variant="caption" color="info.main">
                            🔄 {report.schedule.frequency} - 次回: {report.schedule.nextRun.toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={1}>
                      {report.status === 'completed' && (
                        <Tooltip title="ダウンロード">
                          <IconButton onClick={() => handleDownload(report)}>
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {report.status === 'processing' && (
                        <Box sx={{ width: 60 }}>
                          <LinearProgress />
                        </Box>
                      )}
                      <Tooltip title="実行">
                        <IconButton onClick={() => handleRunReport(report.id)}>
                          <RunIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="設定">
                        <IconButton>
                          <SettingsIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < reports.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );

  const renderTemplates = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">レポートテンプレート</Typography>
        <Button startIcon={<AddIcon />} variant="outlined">
          カスタムテンプレート作成
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {reportTemplates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
                    {template.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1">{template.name}</Typography>
                    <Chip label={template.category} size="small" />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  {template.description}
                </Typography>
                
                <Typography variant="subtitle2" gutterBottom>
                  機能:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {template.features.map((feature) => (
                    <Chip key={feature} label={feature} size="small" variant="outlined" />
                  ))}
                </Box>
                
                <Typography variant="caption" color="text.secondary">
                  対応プラットフォーム: {template.platforms.join(', ')}
                </Typography>
              </CardContent>
              
              <CardActions>
                <Button
                  size="small"
                  onClick={() => setTemplateDialog(true)}
                  startIcon={<AddIcon />}
                >
                  このテンプレートを使用
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderAnalytics = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        レポート分析
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                月次売上トレンド
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                レポートタイプ別統計
              </Typography>
              <List>
                {reportsData.map((item) => (
                  <ListItem key={item.type}>
                    <ListItemText
                      primary={item.type}
                      secondary={`${item.count} レポート`}
                    />
                    <ListItemSecondaryAction>
                      {item.trend === 'up' ? (
                        <TrendingUp color="success" />
                      ) : (
                        <TrendingDown color="error" />
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          📊 レポートセンター
        </Typography>
        <Typography variant="body1" color="text.secondary">
          データドリブンな意思決定のための包括的なレポート機能
        </Typography>
      </Box>

      {/* タブナビゲーション */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab icon={<ReportsIcon />} label="レポート" />
          <Tab icon={<DescriptionIcon />} label="テンプレート" />
          <Tab icon={<TrendingUp />} label="分析" />
        </Tabs>
      </Paper>

      {/* コンテンツ */}
      {activeTab === 0 && renderReportsList()}
      {activeTab === 1 && renderTemplates()}
      {activeTab === 2 && renderAnalytics()}

      {/* レポート作成ダイアログ */}
      <Dialog
        open={reportDialog}
        onClose={() => setReportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>新しいレポートを作成</DialogTitle>
        
        <Stepper activeStep={currentStep} sx={{ px: 3, py: 2 }}>
          <Step>
            <StepLabel>テンプレート選択</StepLabel>
          </Step>
          <Step>
            <StepLabel>設定</StepLabel>
          </Step>
          <Step>
            <StepLabel>確認</StepLabel>
          </Step>
        </Stepper>
        
        <DialogContent>
          {currentStep === 0 && (
            <Box>
              <Typography gutterBottom>
                レポートテンプレートを選択してください
              </Typography>
              <Grid container spacing={2}>
                {reportTemplates.slice(0, 4).map((template) => (
                  <Grid item xs={6} key={template.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { elevation: 4 }
                      }}
                      onClick={() => setCurrentStep(1)}
                    >
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main, mx: 'auto', mb: 1 }}>
                          {template.icon}
                        </Avatar>
                        <Typography variant="subtitle2">
                          {template.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          
          {currentStep === 1 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="レポート名"
                    defaultValue="月次売上レポート - 2024年2月"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="開始日"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="終了日"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>フォーマット</InputLabel>
                    <Select label="フォーマット" defaultValue="pdf">
                      <MenuItem value="pdf">PDF</MenuItem>
                      <MenuItem value="excel">Excel</MenuItem>
                      <MenuItem value="csv">CSV</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>プラットフォーム</InputLabel>
                    <Select
                      label="プラットフォーム"
                      multiple
                      defaultValue={['shopify']}
                    >
                      <MenuItem value="shopify">Shopify</MenuItem>
                      <MenuItem value="rakuten">楽天</MenuItem>
                      <MenuItem value="amazon">Amazon</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {currentStep === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                レポートの設定を確認してください
              </Alert>
              <Typography variant="body2">
                レポート名: 月次売上レポート - 2024年2月<br />
                期間: 2024/02/01 - 2024/02/29<br />
                フォーマット: PDF<br />
                プラットフォーム: Shopify
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>
            キャンセル
          </Button>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              戻る
            </Button>
          )}
          {currentStep < 2 ? (
            <Button 
              variant="contained" 
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              次へ
            </Button>
          ) : (
            <Button 
              variant="contained"
              onClick={() => {
                setReportDialog(false);
                setCurrentStep(0);
              }}
            >
              作成
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* テンプレート使用ダイアログ */}
      <Dialog
        open={templateDialog}
        onClose={() => setTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>テンプレートからレポート作成</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            選択したテンプレートを使用してレポートを作成します。
          </Typography>
          <TextField
            fullWidth
            label="レポート名"
            placeholder="基本売上レポート - 2024年2月"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={() => setTemplateDialog(false)}>
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportsCenter;