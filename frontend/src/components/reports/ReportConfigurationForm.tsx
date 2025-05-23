/**
 * レポート設定フォームコンポーネント
 * 
 * レポートの生成設定を行うためのフォームコンポーネント
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemText,
  Checkbox,
  OutlinedInput,
  Alert,
  InputAdornment,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore,
  CalendarToday,
  Schedule,
  PictureAsPdf,
  TableChart,
  Email,
  Save,
  Edit,
  Description,
  CloudUpload,
  CloudDownload,
  Info,
  Delete,
  Add,
  Notifications,
  Settings,
  Language,
  Storage,
  PlayArrow,
  Done,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { ECPlatform } from '../../types';

// レポート出力フォーマット
type ReportFormat = 'pdf' | 'excel' | 'csv' | 'googleSheet' | 'web';

// レポートの詳細度
type DetailLevel = 'summary' | 'standard' | 'detailed' | 'advanced';

// レポートの配信種類
type DeliveryMethod = 'email' | 'download' | 'storage' | 'api';

// レポートスケジュール頻度
type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

// レポート言語
type ReportLanguage = 'ja' | 'en' | 'zh' | 'ko';

// レポート設定
interface ReportConfig {
  name: string;
  description?: string;
  format: ReportFormat;
  platforms: ECPlatform[];
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
  filters?: Record<string, any>;
  detailLevel: DetailLevel;
  delivery: {
    method: DeliveryMethod[];
    recipients?: string[];
    storage?: string;
  };
  schedule?: {
    enabled: boolean;
    frequency: ScheduleFrequency;
    startDate: Date;
    endDate?: Date;
    time?: string;
    day?: number; // 週次: 0-6 (日-土), 月次: 1-31
    weekday?: number; // 週次: 0-6 (日-土)
    monthday?: number; // 月次: 1-31
  };
  language: ReportLanguage;
  timeZone: string;
  customization?: {
    logo?: boolean;
    colors?: string[];
    headerFooter?: boolean;
    pageNumbers?: boolean;
  };
  notification?: {
    onStart?: boolean;
    onCompletion?: boolean;
    onError?: boolean;
  };
}

// 利用可能なメトリクス
const availableMetrics = [
  { id: 'sales', name: '売上高' },
  { id: 'orders', name: '注文数' },
  { id: 'aov', name: '平均注文額' },
  { id: 'customers', name: '顧客数' },
  { id: 'newCustomers', name: '新規顧客数' },
  { id: 'conversion', name: 'コンバージョン率' },
  { id: 'carts', name: 'カート数' },
  { id: 'abandonedCarts', name: '放棄カート数' },
  { id: 'productViews', name: '商品閲覧数' },
  { id: 'inventory', name: '在庫数' },
  { id: 'outOfStock', name: '在庫切れ商品' },
  { id: 'pageViews', name: 'ページビュー' },
  { id: 'sessions', name: 'セッション数' },
  { id: 'bounceRate', name: '直帰率' },
  { id: 'averageTime', name: '平均滞在時間' },
];

interface ReportConfigurationFormProps {
  initialConfig?: Partial<ReportConfig>;
  onSubmit: (config: ReportConfig) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  showPreview?: boolean;
  className?: string;
}

const ReportConfigurationForm: React.FC<ReportConfigurationFormProps> = ({
  initialConfig,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
  showPreview = true,
  className,
}) => {
  // デフォルトの構成
  const defaultConfig: ReportConfig = {
    name: '',
    description: '',
    format: 'pdf',
    platforms: [],
    dateRange: {
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date(),
    },
    metrics: ['sales', 'orders', 'customers'],
    detailLevel: 'standard',
    delivery: {
      method: ['download'],
      recipients: [],
    },
    language: 'ja',
    timeZone: 'Asia/Tokyo',
  };
  
  // 構成状態
  const [config, setConfig] = useState<ReportConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  
  // スケジュール有効化状態
  const [scheduleEnabled, setScheduleEnabled] = useState(
    initialConfig?.schedule?.enabled || false
  );
  
  // タブ状態
  const [activeTab, setActiveTab] = useState(0);
  
  // バリデーションエラー
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // 構成の更新
  const updateConfig = (path: string, value: any) => {
    // ネストしたパスをサポート（例: 'delivery.method'）
    const pathParts = path.split('.');
    
    if (pathParts.length === 1) {
      setConfig({ ...config, [path]: value });
      
      // エラーをクリア
      if (validationErrors[path]) {
        const newErrors = { ...validationErrors };
        delete newErrors[path];
        setValidationErrors(newErrors);
      }
    } else {
      const [parent, child] = pathParts;
      const parentConfig = config[parent as keyof ReportConfig];
      if (typeof parentConfig === 'object' && parentConfig !== null) {
        setConfig({
          ...config,
          [parent]: {
            ...parentConfig,
            [child]: value,
          },
        });
      }
      
      // エラーをクリア
      if (validationErrors[path]) {
        const newErrors = { ...validationErrors };
        delete newErrors[path];
        setValidationErrors(newErrors);
      }
    }
  };
  
  // スケジュール有効化の切り替え
  const handleScheduleToggle = (enabled: boolean) => {
    setScheduleEnabled(enabled);
    
    if (enabled && !config.schedule) {
      // スケジュールが有効になった場合のデフォルト値を設定
      updateConfig('schedule', {
        enabled: true,
        frequency: 'monthly',
        startDate: new Date(),
        time: '09:00',
      });
    } else if (!enabled && config.schedule) {
      // スケジュールが無効になった場合は設定を保持しながら無効にする
      updateConfig('schedule.enabled', false);
    }
  };
  
  // タブ変更ハンドラー
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // バリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // 必須フィールドのチェック
    if (!config.name.trim()) {
      errors['name'] = 'レポート名は必須です';
    }
    
    if (config.platforms.length === 0) {
      errors['platforms'] = '少なくとも1つのプラットフォームを選択してください';
    }
    
    if (config.metrics.length === 0) {
      errors['metrics'] = '少なくとも1つのメトリクスを選択してください';
    }
    
    if (
      config.delivery.method.includes('email') &&
      (!config.delivery.recipients || config.delivery.recipients.length === 0)
    ) {
      errors['delivery.recipients'] = 'メール送信先は必須です';
    }
    
    // 日付のバリデーション
    if (config.dateRange.start > config.dateRange.end) {
      errors['dateRange'] = '開始日は終了日より前である必要があります';
    }
    
    // スケジュールのバリデーション
    if (scheduleEnabled && config.schedule) {
      if (!config.schedule.startDate) {
        errors['schedule.startDate'] = '開始日は必須です';
      }
      
      if (config.schedule.frequency === 'weekly' && config.schedule.weekday === undefined) {
        errors['schedule.weekday'] = '曜日を選択してください';
      }
      
      if (config.schedule.frequency === 'monthly' && config.schedule.monthday === undefined) {
        errors['schedule.monthday'] = '日を選択してください';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // フォーム送信ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(config);
    }
  };
  
  // メトリクスの選択肢
  const renderMetricsSelect = () => {
    const ITEM_HEIGHT = 48;
    const ITEM_PADDING_TOP = 8;
    const MenuProps = {
      PaperProps: {
        style: {
          maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        },
      },
    };
    
    return (
      <FormControl fullWidth error={!!validationErrors['metrics']}>
        <InputLabel>メトリクス</InputLabel>
        <Select
          multiple
          value={config.metrics}
          onChange={(e) => updateConfig('metrics', e.target.value)}
          input={<OutlinedInput label="メトリクス" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((value) => {
                const metric = availableMetrics.find((m) => m.id === value);
                return <Chip key={value} label={metric?.name || value} size="small" />;
              })}
            </Box>
          )}
          MenuProps={MenuProps}
        >
          {availableMetrics.map((metric) => (
            <MenuItem key={metric.id} value={metric.id}>
              <Checkbox checked={config.metrics.indexOf(metric.id) > -1} />
              <ListItemText primary={metric.name} />
            </MenuItem>
          ))}
        </Select>
        {validationErrors['metrics'] && (
          <FormHelperText error>{validationErrors['metrics']}</FormHelperText>
        )}
      </FormControl>
    );
  };
  
  // デフォルトのタブコンテンツ
  const renderBasicSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          label="レポート名"
          fullWidth
          value={config.name}
          onChange={(e) => updateConfig('name', e.target.value)}
          required
          error={!!validationErrors['name']}
          helperText={validationErrors['name']}
        />
      </Grid>
      
      <Grid item xs={12}>
        <TextField
          label="説明"
          fullWidth
          multiline
          rows={3}
          value={config.description || ''}
          onChange={(e) => updateConfig('description', e.target.value)}
        />
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth error={!!validationErrors['platforms']}>
          <InputLabel>プラットフォーム</InputLabel>
          <Select
            multiple
            value={config.platforms}
            onChange={(e) => updateConfig('platforms', e.target.value)}
            input={<OutlinedInput label="プラットフォーム" />}
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
          {validationErrors['platforms'] && (
            <FormHelperText error>{validationErrors['platforms']}</FormHelperText>
          )}
        </FormControl>
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>出力形式</InputLabel>
          <Select
            value={config.format}
            onChange={(e) => updateConfig('format', e.target.value)}
            label="出力形式"
          >
            <MenuItem value="pdf">PDF</MenuItem>
            <MenuItem value="excel">Excel</MenuItem>
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="googleSheet">Google Sheet</MenuItem>
            <MenuItem value="web">Web (ブラウザ表示)</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <TextField
          label="開始日"
          type="date"
          fullWidth
          value={config.dateRange.start.toISOString().split('T')[0]}
          onChange={(e) => updateConfig('dateRange.start', new Date(e.target.value))}
          InputLabelProps={{ shrink: true }}
          error={!!validationErrors['dateRange']}
        />
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <TextField
          label="終了日"
          type="date"
          fullWidth
          value={config.dateRange.end.toISOString().split('T')[0]}
          onChange={(e) => updateConfig('dateRange.end', new Date(e.target.value))}
          InputLabelProps={{ shrink: true }}
          error={!!validationErrors['dateRange']}
          helperText={validationErrors['dateRange']}
        />
      </Grid>
      
      <Grid item xs={12}>
        {renderMetricsSelect()}
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>詳細レベル</InputLabel>
          <Select
            value={config.detailLevel}
            onChange={(e) => updateConfig('detailLevel', e.target.value)}
            label="詳細レベル"
          >
            <MenuItem value="summary">サマリー (概要のみ)</MenuItem>
            <MenuItem value="standard">標準 (一般的なデータ)</MenuItem>
            <MenuItem value="detailed">詳細 (すべてのデータ)</MenuItem>
            <MenuItem value="advanced">高度 (詳細分析を含む)</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>言語</InputLabel>
          <Select
            value={config.language}
            onChange={(e) => updateConfig('language', e.target.value)}
            label="言語"
          >
            <MenuItem value="ja">日本語</MenuItem>
            <MenuItem value="en">英語</MenuItem>
            <MenuItem value="zh">中国語</MenuItem>
            <MenuItem value="ko">韓国語</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
  
  // 配信設定タブのコンテンツ
  const renderDeliverySettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="subtitle1" gutterBottom>
          配信方法
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={config.delivery.method.includes('download')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...config.delivery.method, 'download']
                    : config.delivery.method.filter((m) => m !== 'download');
                  updateConfig('delivery.method', methods);
                }}
              />
            }
            label="ダウンロード"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={config.delivery.method.includes('email')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...config.delivery.method, 'email']
                    : config.delivery.method.filter((m) => m !== 'email');
                  updateConfig('delivery.method', methods);
                }}
              />
            }
            label="メール"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={config.delivery.method.includes('storage')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...config.delivery.method, 'storage']
                    : config.delivery.method.filter((m) => m !== 'storage');
                  updateConfig('delivery.method', methods);
                }}
              />
            }
            label="ストレージ"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={config.delivery.method.includes('api')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...config.delivery.method, 'api']
                    : config.delivery.method.filter((m) => m !== 'api');
                  updateConfig('delivery.method', methods);
                }}
              />
            }
            label="API"
          />
        </Box>
      </Grid>
      
      {config.delivery.method.includes('email') && (
        <Grid item xs={12}>
          <TextField
            label="メール送信先"
            fullWidth
            placeholder="例: user@example.com, user2@example.com"
            value={config.delivery.recipients?.join(', ') || ''}
            onChange={(e) =>
              updateConfig(
                'delivery.recipients',
                e.target.value.split(',').map((email) => email.trim())
              )
            }
            error={!!validationErrors['delivery.recipients']}
            helperText={
              validationErrors['delivery.recipients'] ||
              'カンマ区切りで複数のメールアドレスを入力できます'
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      )}
      
      {config.delivery.method.includes('storage') && (
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>ストレージ先</InputLabel>
            <Select
              value={config.delivery.storage || ''}
              onChange={(e) => updateConfig('delivery.storage', e.target.value)}
              label="ストレージ先"
            >
              <MenuItem value="google_drive">Google Drive</MenuItem>
              <MenuItem value="dropbox">Dropbox</MenuItem>
              <MenuItem value="s3">Amazon S3</MenuItem>
              <MenuItem value="local">ローカルストレージ</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>
          スケジュール設定
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={scheduleEnabled}
              onChange={(e) => handleScheduleToggle(e.target.checked)}
            />
          }
          label="定期実行を有効にする"
        />
      </Grid>
      
      {scheduleEnabled && (
        <>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>頻度</InputLabel>
              <Select
                value={config.schedule?.frequency || 'monthly'}
                onChange={(e) => updateConfig('schedule.frequency', e.target.value)}
                label="頻度"
              >
                <MenuItem value="once">1回のみ</MenuItem>
                <MenuItem value="daily">毎日</MenuItem>
                <MenuItem value="weekly">毎週</MenuItem>
                <MenuItem value="monthly">毎月</MenuItem>
                <MenuItem value="quarterly">四半期ごと</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="開始日"
              type="date"
              fullWidth
              value={
                config.schedule?.startDate
                  ? config.schedule.startDate.toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
              }
              onChange={(e) =>
                updateConfig('schedule.startDate', new Date(e.target.value))
              }
              InputLabelProps={{ shrink: true }}
              error={!!validationErrors['schedule.startDate']}
              helperText={validationErrors['schedule.startDate']}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="時間"
              type="time"
              fullWidth
              value={config.schedule?.time || '09:00'}
              onChange={(e) => updateConfig('schedule.time', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          {config.schedule?.frequency === 'weekly' && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!validationErrors['schedule.weekday']}>
                <InputLabel>曜日</InputLabel>
                <Select
                  value={config.schedule?.weekday === undefined ? '' : config.schedule.weekday}
                  onChange={(e) => updateConfig('schedule.weekday', e.target.value)}
                  label="曜日"
                >
                  <MenuItem value={0}>日曜日</MenuItem>
                  <MenuItem value={1}>月曜日</MenuItem>
                  <MenuItem value={2}>火曜日</MenuItem>
                  <MenuItem value={3}>水曜日</MenuItem>
                  <MenuItem value={4}>木曜日</MenuItem>
                  <MenuItem value={5}>金曜日</MenuItem>
                  <MenuItem value={6}>土曜日</MenuItem>
                </Select>
                {validationErrors['schedule.weekday'] && (
                  <FormHelperText>{validationErrors['schedule.weekday']}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          )}
          
          {config.schedule?.frequency === 'monthly' && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!validationErrors['schedule.monthday']}>
                <InputLabel>日</InputLabel>
                <Select
                  value={config.schedule?.monthday === undefined ? '' : config.schedule.monthday}
                  onChange={(e) => updateConfig('schedule.monthday', e.target.value)}
                  label="日"
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {i + 1}日
                    </MenuItem>
                  ))}
                  <MenuItem value={0}>月末</MenuItem>
                </Select>
                {validationErrors['schedule.monthday'] && (
                  <FormHelperText>{validationErrors['schedule.monthday']}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <TextField
              label="終了日 (オプション)"
              type="date"
              fullWidth
              value={
                config.schedule?.endDate
                  ? config.schedule.endDate.toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) =>
                updateConfig(
                  'schedule.endDate',
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              InputLabelProps={{ shrink: true }}
              helperText="空白の場合、終了日なし"
            />
          </Grid>
        </>
      )}
      
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>
          通知設定
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.notification?.onStart || false}
                  onChange={(e) =>
                    updateConfig('notification', {
                      ...config.notification,
                      onStart: e.target.checked,
                    })
                  }
                />
              }
              label="レポート生成開始時"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.notification?.onCompletion || false}
                  onChange={(e) =>
                    updateConfig('notification', {
                      ...config.notification,
                      onCompletion: e.target.checked,
                    })
                  }
                />
              }
              label="レポート生成完了時"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.notification?.onError || false}
                  onChange={(e) =>
                    updateConfig('notification', {
                      ...config.notification,
                      onError: e.target.checked,
                    })
                  }
                />
              }
              label="エラー発生時"
            />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
  
  // カスタマイズタブのコンテンツ
  const renderCustomizationSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="subtitle1" gutterBottom>
          レポート外観
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.customization?.logo || false}
                  onChange={(e) =>
                    updateConfig('customization', {
                      ...config.customization,
                      logo: e.target.checked,
                    })
                  }
                />
              }
              label="会社ロゴを表示"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.customization?.headerFooter || false}
                  onChange={(e) =>
                    updateConfig('customization', {
                      ...config.customization,
                      headerFooter: e.target.checked,
                    })
                  }
                />
              }
              label="ヘッダー・フッターを表示"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.customization?.pageNumbers || false}
                  onChange={(e) =>
                    updateConfig('customization', {
                      ...config.customization,
                      pageNumbers: e.target.checked,
                    })
                  }
                />
              }
              label="ページ番号を表示"
            />
          </Grid>
        </Grid>
      </Grid>
      
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>
          カスタムフィルター
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            size="small"
          >
            フィルターを追加
          </Button>
        </Box>
        
        <Alert severity="info">
          カスタムフィルターを追加して、レポートに表示するデータを絞り込むことができます。
        </Alert>
      </Grid>
      
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>
          カスタムセクション
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            size="small"
          >
            セクションを追加
          </Button>
        </Box>
        
        <Alert severity="info">
          カスタムセクションを追加して、レポートの構成をカスタマイズできます。
        </Alert>
      </Grid>
    </Grid>
  );
  
  // レポートプレビュータブのコンテンツ
  const renderPreview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box
          sx={{
            p: 3,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            height: 400,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Description sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            レポートプレビュー
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            レポートの設定を完了すると、ここにプレビューが表示されます。
          </Typography>
          <Button
            variant="outlined"
            sx={{ mt: 2 }}
            startIcon={<PlayArrow />}
          >
            プレビューを生成
          </Button>
        </Box>
      </Grid>
      
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              レポート概要
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>レポート名:</strong> {config.name || '未設定'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>フォーマット:</strong> {config.format.toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>期間:</strong>{' '}
                  {config.dateRange.start.toLocaleDateString()} 〜{' '}
                  {config.dateRange.end.toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>プラットフォーム:</strong>{' '}
                  {config.platforms.length > 0
                    ? config.platforms.join(', ')
                    : '未選択'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>メトリクス:</strong>{' '}
                  {config.metrics
                    .map(m => {
                      const metric = availableMetrics.find(am => am.id === m);
                      return metric ? metric.name : m;
                    })
                    .join(', ')}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>配信方法:</strong>{' '}
                  {config.delivery.method.join(', ')}
                </Typography>
              </Grid>
              {scheduleEnabled && config.schedule && (
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>スケジュール:</strong>{' '}
                    {config.schedule.frequency === 'once'
                      ? '1回のみ'
                      : config.schedule.frequency === 'daily'
                      ? '毎日'
                      : config.schedule.frequency === 'weekly'
                      ? '毎週'
                      : config.schedule.frequency === 'monthly'
                      ? '毎月'
                      : '四半期ごと'}
                    {config.schedule.time && ` ${config.schedule.time}`}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  return (
    <Box className={className}>
      {/* エラーメッセージ */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* ローディングインジケーター */}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      
      {/* タブナビゲーション */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="基本設定" />
          <Tab label="配信とスケジュール" />
          <Tab label="カスタマイズ" />
          {showPreview && <Tab label="プレビュー" />}
        </Tabs>
      </Box>
      
      <form onSubmit={handleSubmit}>
        {/* タブコンテンツ */}
        <Box sx={{ mb: 3 }}>
          {activeTab === 0 && renderBasicSettings()}
          {activeTab === 1 && renderDeliverySettings()}
          {activeTab === 2 && renderCustomizationSettings()}
          {activeTab === 3 && showPreview && renderPreview()}
        </Box>
        
        {/* アクションボタン */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          {onCancel && (
            <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
              キャンセル
            </Button>
          )}
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<CloudDownload />}
            disabled={isLoading}
          >
            {scheduleEnabled ? 'スケジュール設定して実行' : 'レポートを生成'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default ReportConfigurationForm;