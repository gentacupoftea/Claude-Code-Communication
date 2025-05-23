import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Paper,
  Tooltip,
  Slider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  DragIndicator as DragIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  GridView as GridIcon,
  BarChart as ChartIcon,
  Assessment as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  ShoppingCart as OrderIcon,
  Campaign as PromotionIcon,
  Business as SupplierIcon,
  Store as ProductIcon,
  Receipt as ReportIcon,
  Close as CloseIcon
} from '@mui/icons-material';
// Drag and drop functionality temporarily disabled

interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'metric' | 'progress' | 'list';
  title: string;
  dataSource: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: WidgetConfig;
  visible: boolean;
  refreshInterval?: number;
}

interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  dataKeys?: string[];
  filterBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
  timeRange?: '24h' | '7d' | '30d' | '90d' | '1y';
  theme?: 'light' | 'dark' | 'auto';
}

interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardEditor: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout | null>(null);
  const [availableWidgets, setAvailableWidgets] = useState<Partial<DashboardWidget>[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);
  const [widgetDialog, setWidgetDialog] = useState(false);
  const [layoutDialog, setLayoutDialog] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [gridSize, setGridSize] = useState(12);
  const [autoSave, setAutoSave] = useState(true);

  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    const mockWidgets: Partial<DashboardWidget>[] = [
      {
        type: 'kpi',
        title: '総売上',
        dataSource: 'sales',
        config: { theme: 'light' }
      },
      {
        type: 'kpi',
        title: '新規顧客数',
        dataSource: 'customers',
        config: { theme: 'light' }
      },
      {
        type: 'chart',
        title: '売上推移',
        dataSource: 'sales',
        config: { chartType: 'line', showLegend: true, showGrid: true }
      },
      {
        type: 'chart',
        title: 'カテゴリ別売上',
        dataSource: 'categories',
        config: { chartType: 'pie', showLegend: true }
      },
      {
        type: 'chart',
        title: '在庫状況',
        dataSource: 'inventory',
        config: { chartType: 'bar', showGrid: true }
      },
      {
        type: 'table',
        title: '最近の注文',
        dataSource: 'orders',
        config: { timeRange: '24h' }
      },
      {
        type: 'metric',
        title: 'コンバージョン率',
        dataSource: 'analytics',
        config: { aggregation: 'avg' }
      },
      {
        type: 'progress',
        title: '月次目標達成率',
        dataSource: 'targets',
        config: { theme: 'light' }
      }
    ];

    const mockLayout: DashboardLayout = {
      id: '1',
      name: 'メインダッシュボード',
      description: 'デフォルトのダッシュボードレイアウト',
      widgets: [
        {
          id: 'w1',
          type: 'kpi',
          title: '総売上',
          dataSource: 'sales',
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          config: { theme: 'light' },
          visible: true
        },
        {
          id: 'w2',
          type: 'kpi',
          title: '新規顧客数',
          dataSource: 'customers',
          position: { x: 3, y: 0 },
          size: { width: 3, height: 2 },
          config: { theme: 'light' },
          visible: true
        },
        {
          id: 'w3',
          type: 'chart',
          title: '売上推移',
          dataSource: 'sales',
          position: { x: 0, y: 2 },
          size: { width: 6, height: 4 },
          config: { chartType: 'line', showLegend: true, showGrid: true },
          visible: true
        },
        {
          id: 'w4',
          type: 'chart',
          title: 'カテゴリ別売上',
          dataSource: 'categories',
          position: { x: 6, y: 0 },
          size: { width: 6, height: 6 },
          config: { chartType: 'pie', showLegend: true },
          visible: true
        }
      ],
      isDefault: true,
      isPublic: false,
      tags: ['メイン', 'KPI'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setAvailableWidgets(mockWidgets);
    setLayouts([mockLayout]);
    setCurrentLayout(mockLayout);
  };

  // Drag and drop functionality temporarily disabled
  const handleDragEnd = () => {
    console.log('Drag and drop temporarily disabled');
  };

  const addWidget = (widgetTemplate: Partial<DashboardWidget>) => {
    if (!currentLayout) return;

    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      type: widgetTemplate.type!,
      title: widgetTemplate.title!,
      dataSource: widgetTemplate.dataSource!,
      position: { x: 0, y: 0 },
      size: { width: 4, height: 3 },
      config: widgetTemplate.config || {},
      visible: true
    };

    setCurrentLayout({
      ...currentLayout,
      widgets: [...currentLayout.widgets, newWidget],
      updatedAt: new Date()
    });

    if (autoSave) {
      saveLayout();
    }
  };

  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!currentLayout) return;

    setCurrentLayout({
      ...currentLayout,
      widgets: currentLayout.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      ),
      updatedAt: new Date()
    });

    if (autoSave) {
      saveLayout();
    }
  };

  const removeWidget = (widgetId: string) => {
    if (!currentLayout) return;

    setCurrentLayout({
      ...currentLayout,
      widgets: currentLayout.widgets.filter(w => w.id !== widgetId),
      updatedAt: new Date()
    });

    if (autoSave) {
      saveLayout();
    }
  };

  const saveLayout = () => {
    if (!currentLayout) return;

    setLayouts(prev => 
      prev.map(layout => 
        layout.id === currentLayout.id ? currentLayout : layout
      )
    );

    // Here you would typically save to backend
    console.log('Layout saved:', currentLayout);
  };

  const createNewLayout = () => {
    const newLayout: DashboardLayout = {
      id: `layout_${Date.now()}`,
      name: '新規ダッシュボード',
      description: '',
      widgets: [],
      isDefault: false,
      isPublic: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setLayouts(prev => [...prev, newLayout]);
    setCurrentLayout(newLayout);
    setLayoutDialog(false);
  };

  const renderLayoutManager = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">ダッシュボードレイアウト</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setLayoutDialog(true)}
          >
            新規レイアウト
          </Button>
        </Box>

        <Grid container spacing={2}>
          {layouts.map(layout => (
            <Grid item xs={12} md={6} lg={4} key={layout.id}>
              <Card 
                variant="outlined"
                sx={{ 
                  cursor: 'pointer',
                  border: currentLayout?.id === layout.id ? 2 : 1,
                  borderColor: currentLayout?.id === layout.id ? 'primary.main' : 'divider'
                }}
                onClick={() => setCurrentLayout(layout)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DashboardIcon color="primary" />
                    <Typography variant="h6">{layout.name}</Typography>
                    {layout.isDefault && <Chip label="デフォルト" size="small" color="primary" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {layout.description || 'レイアウトの説明なし'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                    {layout.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    ウィジェット数: {layout.widgets.length} | 
                    最終更新: {layout.updatedAt.toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={(e) => {
                    e.stopPropagation();
                    setCurrentLayout(layout);
                    setActiveTab(1);
                  }}>
                    編集
                  </Button>
                  <Button size="small" onClick={(e) => {
                    e.stopPropagation();
                    setPreviewMode(true);
                  }}>
                    プレビュー
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderWidgetLibrary = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>ウィジェットライブラリ</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          以下のウィジェットをドラッグしてダッシュボードに追加できます
        </Typography>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          {availableWidgets.map((widget, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card 
                variant="outlined"
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                }}
                onClick={() => addWidget(widget)}
              >
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  {widget.type === 'kpi' && <TrendingUpIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />}
                  {widget.type === 'chart' && <ChartIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />}
                  {widget.type === 'table' && <GridIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />}
                  {widget.type === 'metric' && <AnalyticsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />}
                  {widget.type === 'progress' && <TrendingUpIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />}
                  
                  <Typography variant="subtitle2" fontWeight="bold">
                    {widget.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {widget.type?.toUpperCase()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEditor = () => (
    <Box>
      {/* Toolbar */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">{currentLayout?.name}</Typography>
            <Divider orientation="vertical" flexItem />
            
            <FormControlLabel
              control={
                <Switch
                  checked={previewMode}
                  onChange={(e) => setPreviewMode(e.target.checked)}
                />
              }
              label="プレビューモード"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
              }
              label="自動保存"
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">グリッドサイズ:</Typography>
              <Slider
                value={gridSize}
                onChange={(e, value) => setGridSize(value as number)}
                min={6}
                max={24}
                step={2}
                sx={{ width: 100 }}
                valueLabelDisplay="auto"
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={saveLayout}
              disabled={autoSave}
            >
              保存
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => generateMockData()}
            >
              リセット
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Widget Grid */}
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            {currentLayout?.widgets.map((widget, index) => (
              <Grid 
                item 
                xs={12} 
                md={widget.size.width} 
                key={widget.id}
              >
                <Card 
                  variant="outlined"
                  sx={{ 
                    height: widget.size.height * 60,
                    opacity: widget.visible ? 1 : 0.5
                  }}
                >
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <DragIcon color="action" sx={{ cursor: 'grab' }} />
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {widget.title}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => updateWidget(widget.id, { visible: !widget.visible })}
                      >
                        {widget.visible ? <ViewIcon /> : <HideIcon />}
                      </IconButton>
                      <IconButton 
                        size="small"
                        onClick={() => {
                          setSelectedWidget(widget);
                          setWidgetDialog(true);
                        }}
                      >
                        <SettingsIcon />
                      </IconButton>
                      <IconButton 
                        size="small"
                        onClick={() => removeWidget(widget.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>

                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {widget.type.toUpperCase()} ウィジェット
                      </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      データソース: {widget.dataSource}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );

  const renderSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>ダッシュボード設定</Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="レイアウト名"
              value={currentLayout?.name || ''}
              onChange={(e) => setCurrentLayout(prev => prev ? { ...prev, name: e.target.value } : null)}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="説明"
              value={currentLayout?.description || ''}
              onChange={(e) => setCurrentLayout(prev => prev ? { ...prev, description: e.target.value } : null)}
              margin="normal"
              multiline
              rows={3}
            />

            <TextField
              fullWidth
              label="タグ (カンマ区切り)"
              value={currentLayout?.tags.join(', ') || ''}
              onChange={(e) => setCurrentLayout(prev => prev ? { 
                ...prev, 
                tags: e.target.value.split(',').map(tag => tag.trim()) 
              } : null)}
              margin="normal"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={currentLayout?.isDefault || false}
                  onChange={(e) => setCurrentLayout(prev => prev ? { 
                    ...prev, 
                    isDefault: e.target.checked 
                  } : null)}
                />
              }
              label="デフォルトレイアウト"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={currentLayout?.isPublic || false}
                  onChange={(e) => setCurrentLayout(prev => prev ? { 
                    ...prev, 
                    isPublic: e.target.checked 
                  } : null)}
                />
              }
              label="公開レイアウト"
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>グローバル設定</Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>デフォルトテーマ</InputLabel>
                <Select value="light" label="デフォルトテーマ">
                  <MenuItem value="light">ライト</MenuItem>
                  <MenuItem value="dark">ダーク</MenuItem>
                  <MenuItem value="auto">自動</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>自動更新間隔</InputLabel>
                <Select value="30s" label="自動更新間隔">
                  <MenuItem value="10s">10秒</MenuItem>
                  <MenuItem value="30s">30秒</MenuItem>
                  <MenuItem value="1m">1分</MenuItem>
                  <MenuItem value="5m">5分</MenuItem>
                  <MenuItem value="off">無効</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <DashboardIcon color="primary" sx={{ fontSize: 40 }} />
        ダッシュボードエディター
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="レイアウト管理" icon={<DashboardIcon />} />
          <Tab label="エディター" icon={<EditIcon />} />
          <Tab label="ウィジェット" icon={<GridIcon />} />
          <Tab label="設定" icon={<SettingsIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderLayoutManager()}
      {activeTab === 1 && renderEditor()}
      {activeTab === 2 && renderWidgetLibrary()}
      {activeTab === 3 && renderSettings()}

      {/* Widget Settings Dialog */}
      <Dialog
        open={widgetDialog}
        onClose={() => setWidgetDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>ウィジェット設定</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="タイトル"
            value={selectedWidget?.title || ''}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>データソース</InputLabel>
            <Select value={selectedWidget?.dataSource || ''} label="データソース">
              <MenuItem value="sales">売上</MenuItem>
              <MenuItem value="customers">顧客</MenuItem>
              <MenuItem value="orders">注文</MenuItem>
              <MenuItem value="inventory">在庫</MenuItem>
              <MenuItem value="analytics">分析</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWidgetDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={() => setWidgetDialog(false)}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* New Layout Dialog */}
      <Dialog
        open={layoutDialog}
        onClose={() => setLayoutDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新規ダッシュボード作成</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="レイアウト名"
            margin="normal"
            autoFocus
          />
          <TextField
            fullWidth
            label="説明"
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLayoutDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={createNewLayout}>作成</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardEditor;