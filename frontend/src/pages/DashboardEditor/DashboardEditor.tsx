import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Paper,
  Grid,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Stack,
  useTheme,
  alpha,
  Tooltip,
  AppBar,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PlusIcon,
  EyeIcon,
  CogIcon,
  CalendarIcon,
  BookmarkIcon as SaveIcon,
  ArrowLeftIcon,
  Squares2X2Icon as ViewGridIcon,
  ListBulletIcon,
  ChartBarIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  TrashIcon,
  PencilIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
// import { DndProvider, useDrag, useDrop } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import { Responsive, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';

// const ResponsiveGridLayout = WidthProvider(Responsive);

interface Widget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text';
  title: string;
  config: any;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Dashboard {
  id: string;
  title: string;
  description: string;
  widgets: Widget[];
  layout: any[];
  dateRange: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

const widgetTypes = [
  { id: 'chart', label: '売上チャート', icon: ChartBarIcon },
  { id: 'table', label: 'データテーブル', icon: TableCellsIcon },
  { id: 'metric', label: 'KPIメトリクス', icon: CurrencyDollarIcon },
  { id: 'text', label: 'テキスト', icon: DocumentTextIcon },
];

const DashboardEditorComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [gridView, setGridView] = useState<'grid' | 'list'>('grid');
  const [addWidgetDialogOpen, setAddWidgetDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  const [dashboard, setDashboard] = useState<Dashboard>({
    id: id || 'new',
    title: '新しいダッシュボード',
    description: '',
    widgets: [],
    layout: [],
    dateRange: 'last30days',
    autoRefresh: false,
    refreshInterval: 5,
  });

  const handleLayoutChange = (layout: any) => {
    setDashboard(prev => ({ ...prev, layout }));
  };

  const handleAddWidget = () => {
    if (!selectedWidgetType) return;

    const newWidget: Widget = {
      id: `widget_${Date.now()}`,
      type: selectedWidgetType as any,
      title: widgetTypes.find(w => w.id === selectedWidgetType)?.label || '',
      config: {},
      x: 0,
      y: Infinity,
      w: 6,
      h: 4,
    };

    setDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));

    setAddWidgetDialogOpen(false);
    setSelectedWidgetType('');
  };

  const handleDeleteWidget = (widgetId: string) => {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
    }));
    setAnchorEl(null);
  };

  const handleSaveDashboard = () => {
    // ダッシュボードを保存する処理
    console.log('Saving dashboard:', dashboard);
    navigate('/dashboards');
  };

  const renderWidget = (widget: Widget) => {
    const WidgetIcon = widgetTypes.find(w => w.id === widget.type)?.icon || ChartBarIcon;

    return (
      <Paper
        key={widget.id}
        sx={{
          height: '100%',
          p: 2,
          position: 'relative',
          overflow: 'hidden',
          cursor: viewMode === 'edit' ? 'move' : 'default',
          bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          '&:hover': viewMode === 'edit' ? {
            boxShadow: theme.shadows[4],
          } : {},
        }}
      >
        {viewMode === 'edit' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 1,
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
                setSelectedWidget(widget);
              }}
            >
              <PencilIcon style={{ width: 16, height: 16 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDeleteWidget(widget.id)}
            >
              <TrashIcon style={{ width: 16, height: 16 }} />
            </IconButton>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <WidgetIcon style={{ width: 24, height: 24, marginRight: 8 }} />
          <Typography variant="h6">{widget.title}</Typography>
        </Box>

        {/* ウィジェットのコンテンツ */}
        <Box
          sx={{
            height: 'calc(100% - 60px)',
            padding: 2,
          }}
        >
          {widget.type === 'metric' && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                ¥1,234,567
              </Typography>
              <Typography variant="body2" color="text.secondary">
                +12.5% 前月比
              </Typography>
            </Box>
          )}
          {widget.type === 'chart' && (
            <Box sx={{ color: 'text.secondary', textAlign: 'center' }}>
              <Typography>チャートエリア</Typography>
              <Typography variant="caption">売上推移データ</Typography>
            </Box>
          )}
          {widget.type === 'table' && (
            <Box sx={{ color: 'text.secondary', textAlign: 'center' }}>
              <Typography>テーブルエリア</Typography>
              <Typography variant="caption">注文一覧データ</Typography>
            </Box>
          )}
          {widget.type === 'text' && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary">
                テキストコンテンツ
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => navigate('/dashboards')}
            sx={{ mr: 2 }}
          >
            <ArrowLeftIcon style={{ width: 20, height: 20 }} />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {dashboard.title}
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<CalendarIcon style={{ width: 16, height: 16 }} />}
              label="過去30日間"
              variant="outlined"
            />

            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="edit">
                <PencilIcon style={{ width: 16, height: 16 }} />
              </ToggleButton>
              <ToggleButton value="preview">
                <EyeIcon style={{ width: 16, height: 16 }} />
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              startIcon={<CogIcon style={{ width: 16, height: 16 }} />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              設定
            </Button>

            <Button
              variant="contained"
              startIcon={<SaveIcon style={{ width: 16, height: 16 }} />}
              onClick={handleSaveDashboard}
            >
              保存
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: theme.palette.mode === 'dark' ? '#000000' : theme.palette.grey[50] }}>
        {viewMode === 'edit' && dashboard.widgets.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Squares2X2Icon
              style={{
                width: 64,
                height: 64,
                color: theme.palette.text.secondary,
                marginBottom: 16,
              }}
            />
            <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
              ダッシュボードは空です
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              ウィジェットを追加して、ダッシュボードの作成を開始しましょう
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlusIcon style={{ width: 20, height: 20 }} />}
              onClick={() => setAddWidgetDialogOpen(true)}
            >
              ウィジェットを追加
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {dashboard.widgets.map(widget => (
              <Grid item xs={12} md={widget.w * 3} key={widget.id}>
                {renderWidget(widget)}
              </Grid>
            ))}
          </Grid>
        )}

        {/* 編集モードのフローティングボタン */}
        {viewMode === 'edit' && dashboard.widgets.length > 0 && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 32,
              right: 32,
            }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<PlusIcon style={{ width: 20, height: 20 }} />}
              onClick={() => setAddWidgetDialogOpen(true)}
              sx={{
                borderRadius: 28,
                py: 2,
                px: 3,
                boxShadow: theme.shadows[8],
              }}
            >
              ウィジェットを追加
            </Button>
          </Box>
        )}
      </Box>

      {/* ウィジェット追加ダイアログ */}
      <Dialog open={addWidgetDialogOpen} onClose={() => setAddWidgetDialogOpen(false)}>
        <DialogTitle>ウィジェットを追加</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {widgetTypes.map(type => (
              <Grid item xs={6} key={type.id}>
                <Paper
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: selectedWidgetType === type.id ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                  onClick={() => setSelectedWidgetType(type.id)}
                >
                  <type.icon style={{ width: 40, height: 40, marginBottom: 8 }} />
                  <Typography>{type.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddWidgetDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleAddWidget}
            variant="contained"
            disabled={!selectedWidgetType}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 設定ダイアログ */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)}>
        <DialogTitle>ダッシュボード設定</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2, minWidth: 400 }}>
            <TextField
              fullWidth
              label="タイトル"
              value={dashboard.title}
              onChange={(e) => setDashboard(prev => ({ ...prev, title: e.target.value }))}
            />
            <TextField
              fullWidth
              label="説明"
              multiline
              rows={3}
              value={dashboard.description}
              onChange={(e) => setDashboard(prev => ({ ...prev, description: e.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel>日付範囲</InputLabel>
              <Select
                value={dashboard.dateRange}
                label="日付範囲"
                onChange={(e) => setDashboard(prev => ({ ...prev, dateRange: e.target.value }))}
              >
                <MenuItem value="today">今日</MenuItem>
                <MenuItem value="yesterday">昨日</MenuItem>
                <MenuItem value="last7days">過去7日間</MenuItem>
                <MenuItem value="last30days">過去30日間</MenuItem>
                <MenuItem value="thisMonth">今月</MenuItem>
                <MenuItem value="lastMonth">先月</MenuItem>
                <MenuItem value="custom">カスタム</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => setSettingsDialogOpen(false)}
            variant="contained"
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* ウィジェット編集メニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          // ウィジェット設定を開く
          setAnchorEl(null);
        }}>
          <CogIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          設定
        </MenuItem>
        <MenuItem onClick={() => {
          // ウィジェットを複製
          setAnchorEl(null);
        }}>
          <PlusIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          複製
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedWidget) {
              handleDeleteWidget(selectedWidget.id);
            }
          }}
          sx={{ color: theme.palette.error.main }}
        >
          <TrashIcon style={{ width: 16, height: 16, marginRight: 8 }} />
          削除
        </MenuItem>
      </Menu>
    </Box>
  );
};

export const DashboardEditor = DashboardEditorComponent;