import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Breadcrumbs,
  Link,
  Chip,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  MoreVert as MoreVertIcon,
  FolderOpen as FolderOpenIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { ProjectSidebar } from './ProjectSidebar';
import { ProjectSettings } from './ProjectSettings';
import { FileUploadManager } from './FileUploadManager';
import { ChatPanel } from '../features/chat/components/ChatPanel/ChatPanel';
import { useProjectStore } from '../../stores/projectStore';

interface ProjectManagerProps {
  children?: React.ReactNode;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ children }) => {
  const {
    folders,
    currentProjectId,
    currentChatId,
    sidebarOpen,
    toggleSidebar,
    selectProject,
    createFolder,
    updateFolder,
    deleteFolder,
    addFile,
    updateFile,
    deleteFile,
    getCurrentProject,
    getProjectFiles,
    getProjectChats,
    createChatSession,
    exportProject,
    importProject,
  } = useProjectStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importData, setImportData] = useState('');

  const currentProject = getCurrentProject();
  const projectFiles = currentProjectId ? getProjectFiles(currentProjectId) : [];
  const projectChats = currentProjectId ? getProjectChats(currentProjectId) : [];

  // プロジェクト選択時の処理
  const handleProjectSelect = useCallback((projectId: string) => {
    selectProject(projectId);
    
    // プロジェクトのAPI設定とシステムプロンプトを読み込み
    const project = folders.find(f => f.id === projectId);
    if (project) {
      // ここでAPI設定やシステムプロンプトを適用
      console.log('Project selected:', project);
    }
  }, [selectProject, folders]);

  // ファイルアップロード処理
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!currentProjectId) return;

    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      
      // ファイル情報を追加
      addFile(currentProjectId, {
        name: file.name,
        type: fileExtension,
        size: file.size,
        processingStatus: 'uploading',
        progress: 0,
      });

      try {
        // ファイルアップロード処理（実際の実装では API 呼び出し）
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', currentProjectId);

        // モック実装
        setTimeout(() => {
          updateFile(`file-${Date.now()}`, {
            processingStatus: 'processing',
            progress: 50,
          });
          
          setTimeout(() => {
            updateFile(`file-${Date.now()}`, {
              processingStatus: 'completed',
              progress: 100,
              url: URL.createObjectURL(file),
              metadata: {
                rows: fileExtension === 'csv' ? Math.floor(Math.random() * 10000) : undefined,
                columns: fileExtension === 'csv' ? ['id', 'name', 'value', 'date'] : undefined,
                summary: `${file.name}のファイルがアップロードされました。`,
                indexed: true,
              },
            });
          }, 2000);
        }, 1000);

      } catch (error) {
        console.error('File upload failed:', error);
        updateFile(`file-${Date.now()}`, {
          processingStatus: 'error',
        });
      }
    }
  }, [currentProjectId, addFile, updateFile]);

  // プロジェクトエクスポート
  const handleExport = useCallback(() => {
    if (!currentProjectId) return;
    
    const data = exportProject(currentProjectId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${currentProject?.name || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setExportDialog(false);
  }, [currentProjectId, currentProject, exportProject]);

  // プロジェクトインポート
  const handleImport = useCallback(() => {
    try {
      const data = JSON.parse(importData);
      importProject(data);
      setImportDialog(false);
      setImportData('');
    } catch (error) {
      console.error('Import failed:', error);
    }
  }, [importData, importProject]);

  // プロジェクト設定保存
  const handleSettingsSave = useCallback((settings: any) => {
    if (!currentProjectId) return;
    
    updateFolder(currentProjectId, {
      systemPrompt: settings.systemPrompt,
      apiSettings: settings.apiSettings,
      promptVariables: settings.promptVariables,
    });
  }, [currentProjectId, updateFolder]);

  // ショートカットキー
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey)) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            // プロジェクト検索機能（今後実装）
            break;
          case 'n':
            event.preventDefault();
            if (event.shiftKey && currentProjectId) {
              // 新規フォルダ作成
              createFolder(currentProjectId, '新しいフォルダ');
            } else if (currentProjectId) {
              // 新規チャット作成
              createChatSession(currentProjectId);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProjectId, createFolder, createChatSession]);

  const getBreadcrumbs = () => {
    if (!currentProject) return [];
    
    const path = [];
    let current = currentProject;
    
    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = folders.find(f => f.id === current.parentId) || null;
      } else {
        break;
      }
    }
    
    return path;
  };

  const handleContextMenuOpen = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* プロジェクトサイドバー */}
      <ProjectSidebar
        open={sidebarOpen}
        onToggle={toggleSidebar}
        onFolderSelect={handleProjectSelect}
        selectedFolderId={currentProjectId || undefined}
      />

      {/* メインコンテンツエリア */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          ml: sidebarOpen ? 0 : -35, // サイドバーが閉じている時の調整
          transition: 'margin-left 0.3s ease',
        }}
      >
        {/* トップバー */}
        <AppBar
          position="static"
          elevation={1}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ minHeight: '48px !important', px: 2 }}>
            {!sidebarOpen && (
              <IconButton
                onClick={toggleSidebar}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* パンくずリスト */}
            <Box sx={{ flex: 1 }}>
              {currentProject && (
                <Breadcrumbs
                  separator={<NavigateNextIcon fontSize="small" />}
                  sx={{ '& .MuiBreadcrumbs-ol': { alignItems: 'center' } }}
                >
                  {getBreadcrumbs().map((folder, index) => (
                    <Link
                      key={folder.id}
                      color="inherit"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleProjectSelect(folder.id);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {index === 0 && <FolderOpenIcon sx={{ mr: 0.5, fontSize: 16 }} />}
                      <Typography variant="body2">{folder.name}</Typography>
                    </Link>
                  ))}
                </Breadcrumbs>
              )}
            </Box>

            {/* プロジェクト情報 */}
            {currentProject && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
                {projectFiles.length > 0 && (
                  <Chip
                    label={`${projectFiles.length}ファイル`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
                {projectChats.length > 0 && (
                  <Chip
                    label={`${projectChats.length}チャット`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
                {currentProject.systemPrompt && (
                  <Chip
                    label="プロンプト設定済み"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </Stack>
            )}

            {/* アクションボタン */}
            {currentProject && (
              <Stack direction="row" spacing={1}>
                <Tooltip title="ファイル管理">
                  <IconButton
                    size="small"
                    onClick={() => setShowFileManager(true)}
                  >
                    <UploadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="プロジェクト設定">
                  <IconButton
                    size="small"
                    onClick={() => setShowSettings(true)}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="その他">
                  <IconButton
                    size="small"
                    onClick={handleContextMenuOpen}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Toolbar>
        </AppBar>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {currentProject ? (
            currentChatId ? (
              <ChatPanel />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 3,
                }}
              >
                <Typography variant="h5" gutterBottom>
                  {currentProject.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  プロジェクトが選択されています。新しいチャットを開始するか、ファイルを管理してください。
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={() => createChatSession(currentProject.id)}
                    sx={{ bgcolor: '#1ABC9C' }}
                  >
                    新しいチャット
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowFileManager(true)}
                  >
                    ファイル管理
                  </Button>
                </Stack>
              </Box>
            )
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 3,
              }}
            >
              <Typography variant="h5" gutterBottom>
                プロジェクトを選択してください
              </Typography>
              <Typography variant="body1" color="text.secondary">
                左側のサイドバーからプロジェクトを選択するか、新しいプロジェクトを作成してください。
              </Typography>
            </Box>
          )}
          {children}
        </Box>
      </Box>

      {/* コンテキストメニュー */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => { setExportDialog(true); handleContextMenuClose(); }}>
          <DownloadIcon sx={{ mr: 1 }} />
          プロジェクトをエクスポート
        </MenuItem>
        <MenuItem onClick={() => { setImportDialog(true); handleContextMenuClose(); }}>
          <UploadIcon sx={{ mr: 1 }} />
          プロジェクトをインポート
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose}>
          <ShareIcon sx={{ mr: 1 }} />
          プロジェクトを共有
        </MenuItem>
      </Menu>

      {/* プロジェクト設定ダイアログ */}
      {currentProject && (
        <ProjectSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          folderId={currentProject.id}
          folderName={currentProject.name}
          onSave={handleSettingsSave}
        />
      )}

      {/* ファイル管理ダイアログ */}
      <Dialog
        open={showFileManager}
        onClose={() => setShowFileManager(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { minHeight: '70vh' } }}
      >
        <DialogTitle>
          ファイル管理: {currentProject?.name}
        </DialogTitle>
        <DialogContent dividers>
          {currentProject && (
            <FileUploadManager
              projectId={currentProject.id}
              files={projectFiles}
              onFileUpload={handleFileUpload}
              onFileDelete={deleteFile}
              onFilePreview={(file) => console.log('Preview file:', file)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFileManager(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      {/* エクスポートダイアログ */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>プロジェクトエクスポート</DialogTitle>
        <DialogContent>
          <Typography>
            プロジェクト「{currentProject?.name}」をJSONファイルとしてエクスポートしますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>キャンセル</Button>
          <Button onClick={handleExport} variant="contained">エクスポート</Button>
        </DialogActions>
      </Dialog>

      {/* インポートダイアログ */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>プロジェクトインポート</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            エクスポートしたJSONファイルの内容を貼り付けてください。
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="JSON データ"
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="エクスポートしたプロジェクトデータを貼り付けてください..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>キャンセル</Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!importData.trim()}
          >
            インポート
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};