import React, { useState, useCallback, useRef } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { DragEndEvent } from '@dnd-kit/core';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Fab,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Dashboard as DashboardIcon,
  Share as ShareIcon,
  Widgets as WidgetsIcon,
} from '@mui/icons-material';
import { Widget, Dashboard } from '../../types';
import { RootState } from '../../store';
import {
  addWidget,
  updateWidget,
  removeWidget,
  setSelectedWidget,
  setEditing,
} from '../../store/dashboardSlice';
import { WidgetRenderer } from '../WidgetRenderer';
import { WidgetLibrary } from '../WidgetLibrary/WidgetLibrary';
import { WidgetSelector } from '../WidgetSelector/WidgetSelector';
import { DragDropProvider } from '../DragAndDrop/DragDropProvider';
import { DropZone } from '../DragAndDrop/DropZone';
import { NaturalLanguageQuery } from '../NaturalLanguageQuery/NaturalLanguageQuery';
import { ChartCustomizer } from '../ChartCustomizer/ChartCustomizer';
import { WidgetEditPanel } from '../WidgetEditPanel/WidgetEditPanel';
import { DashboardSaveDialog, DashboardSaveData } from '../DashboardSaveDialog/DashboardSaveDialog';
import { MobileControls } from '../ResponsiveLayout/MobileControls';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useAutoSave } from '../../hooks/useAutoSave';
import { UndoRedoControls } from '../UXEnhancements/UndoRedoControls';
import { AutoSaveIndicator } from '../UXEnhancements/AutoSaveIndicator';
import { GridGuideLines } from '../UXEnhancements/GridGuideLines';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './DashboardBuilder.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export const DashboardBuilder: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const dispatch = useDispatch();
  const { currentDashboard, isEditing, selectedWidget } = useSelector(
    (state: RootState) => state.dashboard
  );
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showNLQuery, setShowNLQuery] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layouts, setLayouts] = useState<any>({});
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGridGuides, setShowGridGuides] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // UX改善機能のフック
  const {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoActionName,
    getRedoActionName,
    historySize,
  } = useUndoRedo();

  const { saveNow, isAutosaving } = useAutoSave({
    enabled: isEditing,
    onSave: async (dashboard) => {
      // 実際の保存ロジック
      console.log('Auto-saving dashboard:', dashboard);
      setLastSaved(new Date());
    },
    onError: (error) => {
      console.error('Auto-save error:', error);
    },
  });

  const handleLayoutChange = useCallback(
    (layout: Layout[], layouts: any) => {
      setLayouts(layouts);
      // レイアウト変更をウィジェットに反映
      layout.forEach((item) => {
        dispatch(
          updateWidget({
            id: item.i,
            updates: { layout: item },
          })
        );
      });
    },
    [dispatch]
  );

  const handleAddWidget = useCallback(
    (widgetConfig: any) => {
      saveState('ウィジェットを追加');
      
      const newWidget: Widget = {
        id: uuidv4(),
        type: widgetConfig.type,
        config: widgetConfig,
        layout: {
          i: uuidv4(),
          x: 0,
          y: 0,
          w: widgetConfig.defaultSize?.w || 4,
          h: widgetConfig.defaultSize?.h || 4,
        },
        created: new Date(),
        updated: new Date(),
      };

      dispatch(addWidget(newWidget));
      setShowWidgetLibrary(false);
      setShowWidgetSelector(false);
    },
    [dispatch, saveState]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      
      if (over && over.id === 'dashboard-drop-zone') {
        const draggedData = active.data.current;
        if (draggedData) {
          const widgetConfig = {
            type: draggedData.type,
            title: `新しい${draggedData.name}`,
            dataSource: {
              id: 'demo-data',
              type: 'api',
            },
            dimensions: ['category'],
            measures: [{ field: 'value', aggregation: 'sum' }],
            styling: { 
              theme: 'dark', 
              animation: true,
              color: draggedData.color,
            },
            interactions: { tooltip: true, legend: true },
            defaultSize: { w: 4, h: 4 },
          };
          
          handleAddWidget(widgetConfig);
        }
      }
    },
    [handleAddWidget]
  );

  const handleWidgetClick = useCallback(
    (widgetId: string) => {
      if (isEditing) {
        dispatch(setSelectedWidget(widgetId));
        if (isFullscreen) {
          setShowEditPanel(true);
        } else {
          setShowCustomizer(true);
        }
      }
    },
    [dispatch, isEditing, isFullscreen]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      saveState('ウィジェットを削除');
      dispatch(removeWidget(widgetId));
    },
    [dispatch, saveState]
  );

  const toggleEditMode = useCallback(() => {
    dispatch(setEditing(!isEditing));
  }, [dispatch, isEditing]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // 全画面モードの状態変化を監視
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // キーボードショートカット
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 全画面切り替え
      if (e.key === 'F11' || (e.metaKey && e.shiftKey && e.key === 'F')) {
        e.preventDefault();
        toggleFullscreen();
      }
      
      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 's') {
          e.preventDefault();
          saveNow();
        } else if (e.key === 'g') {
          e.preventDefault();
          setShowGridGuides(!showGridGuides);
        }
      }
      
      // ESCでモーダルを閉じる
      if (e.key === 'Escape') {
        setShowWidgetSelector(false);
        setShowWidgetLibrary(false);
        setShowCustomizer(false);
        setShowEditPanel(false);
        setShowNLQuery(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen, undo, redo, saveNow, showGridGuides]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSave = async (data: DashboardSaveData) => {
    setIsSaving(true);
    try {
      // TODO: APIエンドポイントを呼び出してダッシュボードを保存
      const dashboardToSave = {
        ...data,
        config: {
          widgets: currentDashboard.widgets,
          layout: layouts,
          settings: currentDashboard.settings || {}
        }
      };
      
      console.log('保存するダッシュボード:', dashboardToSave);
      
      // 実際のAPI呼び出し（placeholder）
      // await saveDashboard(dashboardToSave);
      
      // 成功メッセージ等の表示
      alert('ダッシュボードが正常に保存されました！');
      
    } catch (error) {
      console.error('ダッシュボードの保存に失敗しました:', error);
      alert('ダッシュボードの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    // ダッシュボード設定をエクスポート
    const dashboardConfig = JSON.stringify(currentDashboard, null, 2);
    const blob = new Blob([dashboardConfig], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${currentDashboard?.name || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    handleMenuClose();
  };

  if (!currentDashboard) {
    return (
      <Box className="dashboard-empty">
        <Typography variant="h4" gutterBottom>
          ダッシュボードを作成しましょう
        </Typography>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => setShowNLQuery(true)}
        >
          自然言語で作成
        </Button>
      </Box>
    );
  }

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <Box className="dashboard-builder">
        <AppBar 
        position="static" 
        className="dashboard-header"
        sx={{
          display: isMobile && isFullscreen ? 'none' : 'block',
        }}
      >
        <Toolbar>
          <Typography 
            variant={isMobile ? "subtitle1" : "h6"} 
            component="div" 
            sx={{ 
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentDashboard.name}
          </Typography>
          
          {!isMobile && (
            <>
              <IconButton
                color="inherit"
                onClick={() => setShowWidgetSelector(true)}
                sx={{
                  backgroundColor: '#34D399',
                  color: '#000000',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: '#059669',
                  },
                }}
              >
                <WidgetsIcon />
              </IconButton>

              <Button
                color="inherit"
                startIcon={<AddIcon />}
                onClick={() => setShowNLQuery(true)}
                sx={{
                  display: isTablet ? 'none' : 'flex',
                }}
              >
                自然言語で追加
              </Button>
              
              <IconButton
                color="inherit"
                onClick={toggleEditMode}
                className={isEditing ? 'editing' : ''}
                sx={{
                  backgroundColor: isEditing ? '#34D399' : 'transparent',
                  color: isEditing ? '#000000' : 'inherit',
                  '&:hover': {
                    backgroundColor: isEditing ? '#059669' : 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                <EditIcon />
              </IconButton>

              <IconButton
                color="inherit"
                onClick={toggleFullscreen}
                title={isFullscreen ? '全画面を終了 (F11)' : '全画面表示 (F11)'}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </>
          )}
          
          <IconButton 
            color="inherit" 
            onClick={handleMenuOpen}
            sx={{
              display: isMobile ? 'none' : 'flex',
            }}
          >
            <SettingsIcon />
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { setShowSaveDialog(true); handleMenuClose(); }}>
              <SaveIcon sx={{ mr: 1 }} /> 保存
            </MenuItem>
            <MenuItem onClick={handleExport}>
              <SaveIcon sx={{ mr: 1 }} /> エクスポート
            </MenuItem>
            <MenuItem onClick={() => {}}>
              <ShareIcon sx={{ mr: 1 }} /> 共有
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box className="dashboard-content">
        <DropZone
          id="dashboard-drop-zone"
          isEmpty={currentDashboard.widgets.length === 0}
        >
          <ResponsiveGridLayout
            className="dashboard-grid"
            layouts={layouts}
            onLayoutChange={handleLayoutChange}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={isMobile ? 50 : 60}
            isDraggable={isEditing && !isMobile}
            isResizable={isEditing && !isMobile}
            compactType="vertical"
            preventCollision={false}
            margin={isMobile ? [8, 8] : [16, 16]}
            containerPadding={isMobile ? [8, 8] : [16, 16]}
          >
            {currentDashboard.widgets.map((widget) => (
              <Paper
                key={widget.id}
                className={`dashboard-widget ${
                  selectedWidget === widget.id ? 'selected' : ''
                }`}
                onClick={() => handleWidgetClick(widget.id)}
                elevation={isEditing ? 4 : 1}
              >
                <WidgetRenderer widget={widget} />
                {isEditing && (
                  <Box className="widget-actions">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWidget(widget.id);
                      }}
                    >
                      ×
                    </IconButton>
                  </Box>
                )}
              </Paper>
            ))}
          </ResponsiveGridLayout>
        </DropZone>
      </Box>

      {/* デスクトップ版のFABボタン */}
      {isEditing && !isMobile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Fab
            sx={{
              backgroundColor: '#34D399',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#059669',
              },
            }}
            onClick={() => setShowWidgetSelector(true)}
          >
            <WidgetsIcon />
          </Fab>
          <Fab
            color="primary"
            onClick={() => setShowWidgetLibrary(true)}
          >
            <AddIcon />
          </Fab>
        </Box>
      )}

      {/* モバイル版のコントロール */}
      <MobileControls
        isEditing={isEditing}
        isFullscreen={isFullscreen}
        onToggleEdit={toggleEditMode}
        onToggleFullscreen={toggleFullscreen}
        onOpenWidgetSelector={() => setShowWidgetSelector(true)}
        onOpenNLQuery={() => setShowNLQuery(true)}
        onOpenSettings={handleMenuOpen}
      />

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={showWidgetLibrary}
        onClose={() => setShowWidgetLibrary(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? '100%' : 300,
            height: isMobile ? '70vh' : '100%',
            borderRadius: isMobile ? '16px 16px 0 0' : 0,
          },
        }}
      >
        <WidgetLibrary onAddWidget={handleAddWidget} />
      </Drawer>

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? '100%' : 400,
            height: isMobile ? '80vh' : '100%',
            borderRadius: isMobile ? '16px 16px 0 0' : 0,
          },
        }}
      >
        {selectedWidget && (
          <ChartCustomizer
            widgetId={selectedWidget}
            onClose={() => setShowCustomizer(false)}
          />
        )}
      </Drawer>

      <WidgetSelector
        open={showWidgetSelector}
        onClose={() => setShowWidgetSelector(false)}
        onAddWidget={handleAddWidget}
      />

      <NaturalLanguageQuery
        open={showNLQuery}
        onClose={() => setShowNLQuery(false)}
        onCreateWidget={handleAddWidget}
      />

      {/* UX改善機能 */}
      <UndoRedoControls
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        undoActionName={getUndoActionName()}
        redoActionName={getRedoActionName()}
        historySize={historySize}
        isVisible={isEditing && !isMobile}
      />

      <AutoSaveIndicator
        isAutosaving={isAutosaving}
        lastSaved={lastSaved}
        isVisible={isEditing}
      />

      <GridGuideLines
        isVisible={showGridGuides && isEditing}
        cols={isMobile ? 4 : 12}
        rowHeight={isMobile ? 50 : 60}
        snapToGrid={true}
      />

      {/* 全画面モード時の編集パネル */}
      {isFullscreen && showEditPanel && selectedWidget && (
        <WidgetEditPanel
          widgetId={selectedWidget}
          onClose={() => setShowEditPanel(false)}
          isFullscreen={true}
        />
      )}

      {/* ダッシュボード保存ダイアログ */}
      <DashboardSaveDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
        isLoading={isSaving}
        initialData={{
          name: currentDashboard?.name || '',
          description: currentDashboard?.description || '',
          tags: currentDashboard?.tags || [],
          visibility: 'private'
        }}
      />
    </Box>
    </DragDropProvider>
  );
};