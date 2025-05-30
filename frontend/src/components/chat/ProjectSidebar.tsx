import React, { useState, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Divider,
  TreeView,
  TreeItem,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightTreeIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

interface ProjectFolder {
  id: string;
  name: string;
  parentId: string | null;
  children: ProjectFolder[];
  systemPrompt?: string;
  apiSettings?: Record<string, any>;
  files?: ProjectFile[];
  isExpanded?: boolean;
}

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  url?: string;
}

interface ProjectSidebarProps {
  open: boolean;
  onToggle: () => void;
  width?: number;
  onFolderSelect: (folderId: string) => void;
  selectedFolderId?: string;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  open,
  onToggle,
  width = 280,
  onFolderSelect,
  selectedFolderId,
}) => {
  const [folders, setFolders] = useState<ProjectFolder[]>([
    {
      id: 'root',
      name: 'プロジェクト',
      parentId: null,
      children: [
        {
          id: 'ec-analysis',
          name: 'EC分析プロジェクト',
          parentId: 'root',
          children: [],
          systemPrompt: 'ECサイトの売上データを分析する専門AIです。',
          files: [
            {
              id: 'file1',
              name: 'sales_data.csv',
              type: 'csv',
              size: 1024000,
              uploadedAt: new Date(),
            }
          ],
        },
        {
          id: 'shopify-project',
          name: 'Shopify連携',
          parentId: 'root',
          children: [],
          apiSettings: {
            shopify: {
              apiKey: 'sk_test_...',
              storeUrl: 'test-store.myshopify.com',
            }
          },
        },
      ],
    },
  ]);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    folderId: string;
  } | null>(null);

  const [dialogState, setDialogState] = useState<{
    type: 'create' | 'rename' | 'settings' | null;
    folderId?: string;
    folderName?: string;
  }>({ type: null });

  const [newFolderName, setNewFolderName] = useState('');

  const handleContextMenu = (event: React.MouseEvent, folderId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      folderId,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateFolder = useCallback((parentId: string) => {
    setDialogState({ type: 'create', folderId: parentId });
    setNewFolderName('');
    handleCloseContextMenu();
  }, []);

  const handleRenameFolder = useCallback((folderId: string) => {
    const folder = findFolderById(folders, folderId);
    setDialogState({ type: 'rename', folderId, folderName: folder?.name || '' });
    setNewFolderName(folder?.name || '');
    handleCloseContextMenu();
  }, [folders]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setFolders(prevFolders => deleteFolderById(prevFolders, folderId));
    handleCloseContextMenu();
  }, []);

  const handleFolderSettings = useCallback((folderId: string) => {
    setDialogState({ type: 'settings', folderId });
    handleCloseContextMenu();
  }, []);

  const findFolderById = (folderList: ProjectFolder[], id: string): ProjectFolder | null => {
    for (const folder of folderList) {
      if (folder.id === id) return folder;
      const found = findFolderById(folder.children, id);
      if (found) return found;
    }
    return null;
  };

  const deleteFolderById = (folderList: ProjectFolder[], id: string): ProjectFolder[] => {
    return folderList
      .filter(folder => folder.id !== id)
      .map(folder => ({
        ...folder,
        children: deleteFolderById(folder.children, id),
      }));
  };

  const handleDialogConfirm = () => {
    if (dialogState.type === 'create' && dialogState.folderId) {
      const newFolder: ProjectFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName,
        parentId: dialogState.folderId,
        children: [],
      };
      
      setFolders(prevFolders => addFolderToParent(prevFolders, dialogState.folderId!, newFolder));
    } else if (dialogState.type === 'rename' && dialogState.folderId) {
      setFolders(prevFolders => updateFolderName(prevFolders, dialogState.folderId!, newFolderName));
    }
    
    setDialogState({ type: null });
    setNewFolderName('');
  };

  const addFolderToParent = (
    folderList: ProjectFolder[],
    parentId: string,
    newFolder: ProjectFolder
  ): ProjectFolder[] => {
    return folderList.map(folder => {
      if (folder.id === parentId) {
        return {
          ...folder,
          children: [...folder.children, newFolder],
        };
      }
      return {
        ...folder,
        children: addFolderToParent(folder.children, parentId, newFolder),
      };
    });
  };

  const updateFolderName = (
    folderList: ProjectFolder[],
    folderId: string,
    newName: string
  ): ProjectFolder[] => {
    return folderList.map(folder => {
      if (folder.id === folderId) {
        return { ...folder, name: newName };
      }
      return {
        ...folder,
        children: updateFolderName(folder.children, folderId, newName),
      };
    });
  };

  const renderTreeItems = (folder: ProjectFolder): React.ReactNode => {
    const isSelected = selectedFolderId === folder.id;
    const hasFiles = folder.files && folder.files.length > 0;
    const hasApiSettings = folder.apiSettings && Object.keys(folder.apiSettings).length > 0;

    return (
      <TreeItem
        key={folder.id}
        nodeId={folder.id}
        label={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 0.5,
              borderRadius: 1,
              backgroundColor: isSelected ? alpha('#1ABC9C', 0.1) : 'transparent',
              '&:hover': {
                backgroundColor: alpha('#1ABC9C', 0.05),
              },
            }}
            onContextMenu={(e) => handleContextMenu(e, folder.id)}
            onClick={() => onFolderSelect(folder.id)}
          >
            <FolderIcon sx={{ mr: 1, color: '#1ABC9C', fontSize: 18 }} />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {folder.name}
            </Typography>
            
            {/* インジケーター */}
            <Stack direction="row" spacing={0.5}>
              {hasFiles && (
                <Tooltip title={`${folder.files?.length || 0}個のファイル`}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#3498DB',
                    }}
                  />
                </Tooltip>
              )}
              {hasApiSettings && (
                <Tooltip title="API設定あり">
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#E74C3C',
                    }}
                  />
                </Tooltip>
              )}
              {folder.systemPrompt && (
                <Tooltip title="システムプロンプト設定済み">
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#F39C12',
                    }}
                  />
                </Tooltip>
              )}
            </Stack>

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, folder.id);
              }}
              sx={{ ml: 0.5, opacity: 0.7 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        icon={
          folder.children.length > 0 ? (
            <ExpandMoreIcon />
          ) : (
            <ChevronRightTreeIcon />
          )
        }
      >
        {folder.children.map(child => renderTreeItems(child))}
      </TreeItem>
    );
  };

  return (
    <>
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: open ? width : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: width,
            boxSizing: 'border-box',
            backgroundColor: '#FAFAFA',
            borderRight: '1px solid #E0E0E0',
          },
        }}
      >
        {/* ヘッダー */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid #E0E0E0',
          }}
        >
          <Typography variant="h6" sx={{ color: '#2C3E50', fontWeight: 600 }}>
            プロジェクト管理
          </Typography>
          <IconButton onClick={onToggle} size="small">
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        {/* ツールバー */}
        <Box sx={{ p: 1, borderBottom: '1px solid #E0E0E0' }}>
          <Stack direction="row" spacing={1}>
            <Tooltip title="新規フォルダ">
              <IconButton
                size="small"
                onClick={() => handleCreateFolder('root')}
                sx={{ color: '#1ABC9C' }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="ファイルアップロード">
              <IconButton size="small" sx={{ color: '#3498DB' }}>
                <UploadIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* フォルダツリー */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          <TreeView
            defaultCollapseIcon={<ExpandMoreIcon />}
            defaultExpandIcon={<ChevronRightTreeIcon />}
            defaultExpanded={['root']}
            selected={selectedFolderId || ''}
          >
            {folders.map(folder => renderTreeItems(folder))}
          </TreeView>
        </Box>
      </Drawer>

      {/* トグルボタン（サイドバーが閉じている時） */}
      {!open && (
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'fixed',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1300,
            backgroundColor: 'white',
            boxShadow: 2,
            '&:hover': {
              backgroundColor: '#f5f5f5',
            },
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}

      {/* コンテキストメニュー */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleCreateFolder(contextMenu?.folderId || '')}>
          <AddIcon sx={{ mr: 1 }} />
          新規フォルダ
        </MenuItem>
        <MenuItem onClick={() => handleRenameFolder(contextMenu?.folderId || '')}>
          <EditIcon sx={{ mr: 1 }} />
          名前変更
        </MenuItem>
        <MenuItem onClick={() => handleFolderSettings(contextMenu?.folderId || '')}>
          <SettingsIcon sx={{ mr: 1 }} />
          設定
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleDeleteFolder(contextMenu?.folderId || '')}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          削除
        </MenuItem>
      </Menu>

      {/* フォルダ作成・名前変更ダイアログ */}
      <Dialog
        open={dialogState.type === 'create' || dialogState.type === 'rename'}
        onClose={() => setDialogState({ type: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogState.type === 'create' ? '新規フォルダ作成' : 'フォルダ名変更'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="フォルダ名"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogState({ type: null })}>
            キャンセル
          </Button>
          <Button
            onClick={handleDialogConfirm}
            disabled={!newFolderName.trim()}
            variant="contained"
            sx={{ bgcolor: '#1ABC9C' }}
          >
            {dialogState.type === 'create' ? '作成' : '更新'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};