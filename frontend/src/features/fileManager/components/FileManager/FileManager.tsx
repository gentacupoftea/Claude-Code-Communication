import React, { useState, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  LinearProgress,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CloudUpload as CloudUploadIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  FilePresent as FilePresentIcon,
  Description as DescriptionIcon,
  TableChart as TableChartIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useFileStore } from '../../store/fileStore';
import { FilePreview } from '../FilePreview/FilePreview';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  path: string;
  createdAt: Date;
  modifiedAt: Date;
  content?: string | ArrayBuffer;
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return <FileIcon />;
  
  if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return <TableChartIcon sx={{ color: '#34d399' }} />;
  }
  if (mimeType.includes('pdf')) {
    return <FilePresentIcon sx={{ color: '#ef4444' }} />;
  }
  if (mimeType.includes('text') || mimeType.includes('markdown')) {
    return <DescriptionIcon sx={{ color: '#3b82f6' }} />;
  }
  if (mimeType.includes('javascript') || mimeType.includes('json')) {
    return <CodeIcon sx={{ color: '#f59e0b' }} />;
  }
  
  return <FileIcon />;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const FileManager: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuFile, setMenuFile] = useState<FileItem | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const {
    files,
    uploadFile,
    deleteFile,
    createFolder,
    getFilesInPath,
  } = useFileStore();

  const currentFiles = getFilesInPath(currentPath);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      await uploadFile(file, currentPath);
    }
  }, [currentPath, uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
  });

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'folder') {
      handleNavigate(file.path);
    } else {
      setSelectedFile(file);
      setPreviewOpen(true);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, file: FileItem) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuFile(null);
  };

  const handleDelete = () => {
    if (menuFile) {
      deleteFile(menuFile.id);
    }
    handleMenuClose();
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim(), currentPath);
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">ファイル管理</Typography>
          <IconButton
            size="small"
            onClick={() => setNewFolderDialogOpen(true)}
            sx={{ color: '#34d399' }}
          >
            <CreateNewFolderIcon />
          </IconButton>
        </Box>
        
        {/* パンくずリスト */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ '& .MuiBreadcrumbs-li': { maxWidth: 150 } }}
        >
          <Link
            component="button"
            underline="hover"
            color="inherit"
            onClick={() => handleNavigate('/')}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 20 }} />
            ホーム
          </Link>
          {pathParts.map((part, index) => {
            const path = '/' + pathParts.slice(0, index + 1).join('/');
            const isLast = index === pathParts.length - 1;
            
            return (
              <Link
                key={path}
                component="button"
                underline={isLast ? 'none' : 'hover'}
                color={isLast ? 'text.primary' : 'inherit'}
                onClick={() => !isLast && handleNavigate(path)}
                sx={{
                  cursor: isLast ? 'default' : 'pointer',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {part}
              </Link>
            );
          })}
        </Breadcrumbs>
      </Box>

      {/* ドロップゾーン */}
      <Box
        {...getRootProps()}
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          bgcolor: isDragActive ? 'action.hover' : 'background.default',
          transition: 'background-color 0.2s',
        }}
      >
        <input {...getInputProps()} />
        
        {isDragActive && (
          <Paper
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              p: 4,
              bgcolor: 'background.paper',
              boxShadow: 3,
              zIndex: 10,
              textAlign: 'center',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: '#34d399', mb: 2 }} />
            <Typography variant="h6">ファイルをドロップしてアップロード</Typography>
          </Paper>
        )}

        {/* ファイルリスト */}
        <List sx={{ p: 0 }}>
          {currentFiles.map((file) => (
            <ListItem
              key={file.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="more"
                  onClick={(e) => handleMenuOpen(e, file)}
                >
                  <MoreVertIcon />
                </IconButton>
              }
            >
              <ListItemButton onClick={() => handleFileClick(file)}>
                <ListItemIcon>
                  {file.type === 'folder' ? (
                    <FolderIcon sx={{ color: '#f59e0b' }} />
                  ) : (
                    getFileIcon(file.mimeType)
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(file.modifiedAt, 'yyyy/MM/dd HH:mm', { locale: ja })}
                      </Typography>
                      {file.size && (
                        <Chip
                          label={formatFileSize(file.size)}
                          size="small"
                          sx={{ height: 16, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {currentFiles.length === 0 && (
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
            <CloudUploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary" variant="body1" gutterBottom>
              ファイルがありません
            </Typography>
            <Typography color="text.secondary" variant="body2">
              ファイルをドラッグ&ドロップするか、クリックしてアップロード
            </Typography>
          </Box>
        )}
      </Box>

      {/* コンテキストメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDelete}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          削除
        </MenuItem>
      </Menu>

      {/* ファイルプレビューダイアログ */}
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setSelectedFile(null);
          }}
        />
      )}

      {/* 新規フォルダ作成ダイアログ */}
      <Dialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>新しいフォルダを作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="フォルダ名"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreateFolder}
            variant="contained"
            sx={{
              bgcolor: '#34d399',
              '&:hover': { bgcolor: '#2dc08a' },
            }}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};