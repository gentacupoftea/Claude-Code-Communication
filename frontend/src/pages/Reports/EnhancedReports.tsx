/**
 * 強化されたレポートページ
 * 
 * レポート生成、テンプレート選択、分析のための総合的なUI
 */
import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  Tab,
  Tabs,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Badge,
  Stepper,
  Step,
  StepLabel,
  useTheme,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Description,
  History,
  TableChart,
  Add,
  CloudDownload,
  Schedule,
  Settings,
  ArrowBack,
  ArrowForward,
  BarChart as BarChartIcon,
  FilterList,
  Refresh,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { ReportTemplateSelector, ReportConfigurationForm } from '../../components/reports';
import { AnalyticsChartSelector, AnalyticsSummary } from '../../components/analytics';
import { ECPlatform } from '../../types';

// レポート生成ワークフローのステップ
type ReportCreationStep = 'select' | 'configure' | 'review' | 'complete';

// レポートタイプ
type ReportType = 'sales' | 'inventory' | 'customer' | 'seo' | 'custom';

// レポートステータス
type ReportStatus = 'completed' | 'processing' | 'scheduled' | 'failed';

// レポートモデル
interface Report {
  id: string;
  name: string;
  type: ReportType;
  platforms: ECPlatform[];
  dateRange: { start: Date; end: Date };
  format: 'pdf' | 'excel' | 'csv';
  status: ReportStatus;
  createdAt: Date;
  fileSize?: number;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRun: Date;
  };
}

// レポートテンプレート
interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
  format: string[];
}

// ページタブ
type PageTab = 'reports' | 'templates' | 'insights';

const EnhancedReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  // ページの状態
  const [activeTab, setActiveTab] = useState<PageTab>('reports');
  const [creationStep, setCreationStep] = useState<ReportCreationStep>('select');
  const [reports, setReports] = useState<Report[]>([
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
  ]);
  
  // レポート作成関連の状態
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportConfig, setReportConfig] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // タブ切り替え
  const handleTabChange = (event: React.SyntheticEvent, newValue: PageTab) => {
    setActiveTab(newValue);
  };
  
  // レポート作成開始
  const handleStartReportCreation = () => {
    setIsCreatingReport(true);
    setCreationStep('select');
    setSelectedTemplate(null);
    setReportConfig(null);
  };
  
  // テンプレート選択処理
  const handleSelectTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setCreationStep('configure');
  };
  
  // レポート設定処理
  const handleConfigureReport = (config: any) => {
    setReportConfig(config);
    setCreationStep('review');
  };
  
  // レポート生成処理
  const handleGenerateReport = () => {
    setIsGenerating(true);
    setGenerationError(null);
    
    // レポート生成をシミュレート
    setTimeout(() => {
      try {
        // 成功シミュレーション
        const newReport: Report = {
          id: `${Date.now()}`,
          name: reportConfig.name,
          type: selectedTemplate?.category as ReportType || 'custom',
          platforms: reportConfig.platforms,
          dateRange: reportConfig.dateRange,
          format: reportConfig.format,
          status: reportConfig.schedule?.enabled ? 'scheduled' : 'completed',
          createdAt: new Date(),
          fileSize: 1.8,
          ...(reportConfig.schedule?.enabled
            ? {
                schedule: {
                  frequency: reportConfig.schedule.frequency,
                  nextRun: reportConfig.schedule.startDate,
                },
              }
            : {}),
        };
        
        setReports([newReport, ...reports]);
        setCreationStep('complete');
      } catch (error) {
        setGenerationError((error as Error).message || 'レポートの生成中にエラーが発生しました');
      } finally {
        setIsGenerating(false);
      }
    }, 2000);
  };
  
  // レポート作成キャンセル
  const handleCancelReportCreation = () => {
    setIsCreatingReport(false);
  };
  
  // レポート作成完了
  const handleFinishReportCreation = () => {
    setIsCreatingReport(false);
    setActiveTab('reports');
  };
  
  // レポートダウンロード
  const handleDownloadReport = (report: Report) => {
    console.log('Downloading report:', report);
    // ダウンロード処理
  };
  
  // レポート作成ワークフロー
  const renderReportCreationWorkflow = () => {
    if (!isCreatingReport) return null;
    
    return (
      <Dialog open={isCreatingReport} fullWidth maxWidth="lg">
        <DialogTitle>
          {creationStep === 'select'
            ? 'レポートテンプレートの選択'
            : creationStep === 'configure'
            ? 'レポート設定'
            : creationStep === 'review'
            ? 'レポートのレビューと生成'
            : 'レポート生成完了'}
        </DialogTitle>
        
        <Stepper activeStep={
          creationStep === 'select' ? 0 :
          creationStep === 'configure' ? 1 :
          creationStep === 'review' ? 2 : 3
        } sx={{ px: 3, py: 2 }}>
          <Step>
            <StepLabel>テンプレート選択</StepLabel>
          </Step>
          <Step>
            <StepLabel>レポート設定</StepLabel>
          </Step>
          <Step>
            <StepLabel>確認と生成</StepLabel>
          </Step>
          <Step>
            <StepLabel>完了</StepLabel>
          </Step>
        </Stepper>
        
        <DialogContent dividers>
          {creationStep === 'select' && (
            <ReportTemplateSelector onSelect={handleSelectTemplate} />
          )}
          
          {creationStep === 'configure' && selectedTemplate && (
            <ReportConfigurationForm
              initialConfig={{
                name: selectedTemplate.name,
                description: selectedTemplate.description,
              }}
              onSubmit={handleConfigureReport}
              onCancel={handleCancelReportCreation}
            />
          )}
          
          {creationStep === 'review' && selectedTemplate && reportConfig && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    レポート設定
                  </Typography>
                  
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          レポート名
                        </Typography>
                        <Typography variant="body1">{reportConfig.name}</Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          テンプレート
                        </Typography>
                        <Typography variant="body1">{selectedTemplate.name}</Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          期間
                        </Typography>
                        <Typography variant="body1">
                          {reportConfig.dateRange.start.toLocaleDateString()} ～{' '}
                          {reportConfig.dateRange.end.toLocaleDateString()}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          フォーマット
                        </Typography>
                        <Typography variant="body1">
                          {reportConfig.format.toUpperCase()}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          プラットフォーム
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {reportConfig.platforms.map((platform: string) => (
                            <Chip key={platform} label={platform} size="small" />
                          ))}
                        </Box>
                      </Grid>
                      
                      {reportConfig.schedule?.enabled && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary">
                            スケジュール
                          </Typography>
                          <Typography variant="body1">
                            {reportConfig.schedule.frequency === 'daily'
                              ? '毎日'
                              : reportConfig.schedule.frequency === 'weekly'
                              ? '毎週'
                              : reportConfig.schedule.frequency === 'monthly'
                              ? '毎月'
                              : ''}
                            {reportConfig.schedule.time && ` ${reportConfig.schedule.time}`}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                  
                  {generationError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {generationError}
                    </Alert>
                  )}
                  
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    startIcon={<CloudDownload />}
                  >
                    {isGenerating ? 'レポート生成中...' : 'レポートを生成'}
                  </Button>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    プレビュー
                  </Typography>
                  
                  <Box
                    sx={{
                      height: 400,
                      bgcolor: 'background.paper',
                      border: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      p: 2,
                    }}
                  >
                    <Description sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      レポートプレビュー
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      設定に基づいたレポートのプレビューです
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {creationStep === 'complete' && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                レポートの生成が完了しました
              </Typography>
              
              <Typography variant="body1" paragraph>
                {reportConfig.schedule?.enabled
                  ? 'レポートは設定されたスケジュールに従って生成されます'
                  : 'レポートが正常に生成されました'}
              </Typography>
              
              <Button
                variant="contained"
                onClick={handleFinishReportCreation}
                sx={{ mt: 2 }}
              >
                完了
              </Button>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          {creationStep !== 'complete' && (
            <Button onClick={handleCancelReportCreation}>キャンセル</Button>
          )}
          
          {creationStep === 'configure' && (
            <Button
              startIcon={<ArrowBack />}
              onClick={() => setCreationStep('select')}
            >
              戻る
            </Button>
          )}
          
          {creationStep === 'review' && (
            <Button
              startIcon={<ArrowBack />}
              onClick={() => setCreationStep('configure')}
            >
              戻る
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };
  
  // レポート一覧タブのコンテンツ
  const renderReportsTab = () => {
    return (
      <>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">レポート一覧</Typography>
          
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleStartReportCreation}
          >
            新規レポート作成
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          {reports.map((report) => (
            <Grid item xs={12} sm={6} md={4} key={report.id}>
              <Paper
                variant="outlined"
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {report.status === 'processing' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      bgcolor: 'primary.main',
                      animation: 'progress 2s infinite linear',
                      '@keyframes progress': {
                        '0%': { transform: 'translateX(-100%)' },
                        '100%': { transform: 'translateX(100%)' },
                      },
                    }}
                  />
                )}
                
                <Box sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
                      {report.name}
                    </Typography>
                    
                    <Chip
                      label={
                        report.status === 'completed'
                          ? '完了'
                          : report.status === 'processing'
                          ? '処理中'
                          : report.status === 'scheduled'
                          ? '予定'
                          : '失敗'
                      }
                      size="small"
                      color={
                        report.status === 'completed'
                          ? 'success'
                          : report.status === 'processing'
                          ? 'warning'
                          : report.status === 'scheduled'
                          ? 'info'
                          : 'error'
                      }
                    />
                  </Box>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      height: 40,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {report.type} データの分析レポート
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" display="block" color="text.secondary">
                      期間: {report.dateRange.start.toLocaleDateString()} ～{' '}
                      {report.dateRange.end.toLocaleDateString()}
                    </Typography>
                    
                    <Typography variant="caption" display="block" color="text.secondary">
                      プラットフォーム: {report.platforms.join(', ')}
                    </Typography>
                    
                    <Typography variant="caption" display="block" color="text.secondary">
                      {report.createdAt.toLocaleDateString()} {report.createdAt.toLocaleTimeString()}
                    </Typography>
                    
                    {report.schedule && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        次回: {report.schedule.nextRun.toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
                
                <Divider />
                
                <Box
                  sx={{
                    display: 'flex',
                    p: 1,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip
                      label={report.format.toUpperCase()}
                      size="small"
                      icon={
                        report.format === 'pdf' ? (
                          <Description fontSize="small" />
                        ) : (
                          <TableChart fontSize="small" />
                        )
                      }
                      variant="outlined"
                    />
                    
                    {report.fileSize && (
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        {report.fileSize} MB
                      </Typography>
                    )}
                  </Box>
                  
                  <Box>
                    {report.status === 'completed' && (
                      <Button
                        size="small"
                        startIcon={<CloudDownload />}
                        onClick={() => handleDownloadReport(report)}
                      >
                        ダウンロード
                      </Button>
                    )}
                    
                    {report.status === 'scheduled' && (
                      <Tooltip title="スケジュール設定">
                        <IconButton size="small">
                          <Schedule fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </>
    );
  };
  
  // テンプレートタブのコンテンツ
  const renderTemplatesTab = () => {
    return (
      <>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">レポートテンプレート</Typography>
        </Box>
        
        <ReportTemplateSelector
          onSelect={(template) => {
            setSelectedTemplate(template);
            setIsCreatingReport(true);
            setCreationStep('configure');
          }}
          showCategories={true}
          showSearch={true}
        />
      </>
    );
  };
  
  // インサイトタブのコンテンツ
  const renderInsightsTab = () => {
    // サンプルインサイトデータ
    const insights = [
      {
        id: '1',
        title: '売上が前月比20%増加',
        description: '先月の売上が前月と比較して20%増加しました。これは新商品の導入とプロモーションキャンペーンの成功によるものです。',
        type: 'positive' as const,
        metric: '売上',
        value: '¥5,230,450',
        previousValue: '¥4,358,708',
        percentChange: 20,
        trend: 'up' as const,
        priority: 'high' as const,
        timestamp: new Date('2024-02-01'),
        isPinned: true,
      },
      {
        id: '2',
        title: '在庫切れリスクのある商品が増加',
        description: '5つの人気商品が今後2週間以内に在庫切れになるリスクがあります。すぐに発注が必要です。',
        type: 'warning' as const,
        metric: '在庫切れリスク商品',
        value: '5商品',
        previousValue: '2商品',
        percentChange: 150,
        trend: 'up' as const,
        priority: 'high' as const,
        timestamp: new Date('2024-02-02'),
      },
      {
        id: '3',
        title: '新規顧客獲得率が減少',
        description: '新規顧客の獲得率が前月比15%減少しました。マーケティング戦略の見直しが必要です。',
        type: 'negative' as const,
        metric: '新規顧客獲得率',
        value: '12.3%',
        previousValue: '14.5%',
        percentChange: -15,
        trend: 'down' as const,
        priority: 'medium' as const,
        timestamp: new Date('2024-02-03'),
      },
    ];
    
    // サンプルメトリクスデータ
    const keyMetrics = [
      {
        name: '売上高',
        value: 5230450,
        unit: '円',
        previousValue: 4358708,
        percentChange: 20,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        name: '注文数',
        value: 1284,
        previousValue: 1102,
        percentChange: 16.5,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        name: '平均注文額',
        value: 4073,
        unit: '円',
        previousValue: 3955,
        percentChange: 3,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        name: 'コンバージョン率',
        value: 3.2,
        unit: '%',
        previousValue: 2.8,
        percentChange: 14.3,
        trend: 'up' as const,
        isPositive: true,
      },
    ];
    
    // サンプルセグメントデータ
    const topSegments = [
      {
        segmentType: '地域',
        segmentName: '東京',
        metricName: '売上高',
        value: 1852030,
        unit: '円',
        percentChange: 23,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        segmentType: '地域',
        segmentName: '大阪',
        metricName: '売上高',
        value: 945120,
        unit: '円',
        percentChange: 18,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        segmentType: '商品カテゴリ',
        segmentName: '電子機器',
        metricName: '売上高',
        value: 1542300,
        unit: '円',
        percentChange: 32,
        trend: 'up' as const,
        isPositive: true,
      },
      {
        segmentType: '顧客タイプ',
        segmentName: 'リピーター',
        metricName: '売上高',
        value: 3245800,
        unit: '円',
        percentChange: 15,
        trend: 'up' as const,
        isPositive: true,
      },
    ];
    
    return (
      <>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">データインサイト</Typography>
          
          <Box>
            <Button startIcon={<FilterList />} sx={{ mr: 1 }}>
              フィルター
            </Button>
            <Button startIcon={<Refresh />}>
              更新
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AnalyticsSummary
              title="月次サマリー"
              subtitle="2024年1月の分析"
              dateRange={{
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
              }}
              insights={insights}
              keyMetrics={keyMetrics}
              topSegments={topSegments}
              onExport={() => console.log('Exporting analytics summary')}
              onInsightPin={(id) => console.log('Pinning insight', id)}
            />
          </Grid>
          
          <Grid item xs={12} lg={6}>
            <AnalyticsChartSelector
              title="売上トレンド"
              defaultChartType="line"
              availableChartTypes={['bar', 'line', 'area']}
              height={400}
              onRefresh={() => console.log('Refreshing chart data')}
            />
          </Grid>
          
          <Grid item xs={12} lg={6}>
            <AnalyticsChartSelector
              title="カテゴリ別売上"
              defaultChartType="pie"
              availableChartTypes={['pie', 'donut', 'bar']}
              height={400}
              onRefresh={() => console.log('Refreshing chart data')}
            />
          </Grid>
        </Grid>
      </>
    );
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('reports.title')}
        </Typography>
        <Typography color="text.secondary">
          {t('reports.description')}
        </Typography>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="レポート" value="reports" />
          <Tab label="テンプレート" value="templates" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                インサイト
                <Badge color="error" variant="dot" sx={{ ml: 1 }}>
                  <BarChartIcon sx={{ fontSize: 20 }} />
                </Badge>
              </Box>
            } 
            value="insights" 
          />
        </Tabs>
      </Box>
      
      {activeTab === 'reports' && renderReportsTab()}
      {activeTab === 'templates' && renderTemplatesTab()}
      {activeTab === 'insights' && renderInsightsTab()}
      
      {/* レポート作成ワークフロー */}
      {renderReportCreationWorkflow()}
    </Container>
  );
};

// 不足しているアイコンの追加
import { CheckCircle } from '@mui/icons-material';

// レイアウトでラップ
export const EnhancedReports = mainLayout(EnhancedReportsPage);