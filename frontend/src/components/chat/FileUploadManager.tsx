import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  Description as DescriptionIcon,
  TableChart as TableChartIcon,
  PictureAsPdf as PdfIcon,
  Code as JsonIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  url?: string;
  processingStatus?: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  metadata?: {
    rows?: number;
    columns?: string[];
    summary?: string;
  };
}

interface FileUploadManagerProps {
  projectId: string;
  files: ProjectFile[];
  onFileUpload: (files: File[]) => void;
  onFileDelete: (fileId: string) => void;
  onFilePreview: (file: ProjectFile) => void;
}

const SUPPORTED_FORMATS = [
  '.csv', '.txt', '.md', '.xlsx', '.xls', '.json', '.pdf'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({
  projectId,
  files,
  onFileUpload,
  onFileDelete,
  onFilePreview,
}) => {
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return <TableChartIcon />;
      case 'pdf':
        return <PdfIcon />;
      case 'json':
        return <JsonIcon />;
      case 'md':
      case 'txt':
        return <DescriptionIcon />;
      default:
        return <FileIcon />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return '#4CAF50';
      case 'pdf':
        return '#F44336';
      case 'json':
        return '#FF9800';
      case 'md':
      case 'txt':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidFormat = SUPPORTED_FORMATS.includes(extension);
      const isValidSize = file.size <= MAX_FILE_SIZE;
      
      if (!isValidFormat) {
        console.error(`Unsupported file format: ${extension}`);
        return false;
      }
      
      if (!isValidSize) {
        console.error(`File too large: ${formatFileSize(file.size)}`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      onFileUpload(validFiles);
    }
  }, [onFileUpload]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const handlePreview = (file: ProjectFile) => {
    setPreviewFile(file);
    onFilePreview(file);
  };

  const handleDownload = async (file: ProjectFile) => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Box>
      {/* ファイルアップロードエリア */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 3,
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive 
            ? (isDragReject ? 'error.main' : 'primary.main')
            : 'grey.300',
          backgroundColor: isDragActive 
            ? (isDragReject ? 'error.light' : 'primary.light')
            : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover',
          },
          mb: 3,
        }}
      >
        <input {...getInputProps()} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CloudUploadIcon
            sx={{
              fontSize: 48,
              color: isDragActive
                ? (isDragReject ? 'error.main' : 'primary.main')
                : 'text.secondary',
            }}
          />
          <Typography variant="h6" textAlign="center">
            {isDragActive
              ? isDragReject
                ? 'サポートされていないファイル形式です'
                : 'ファイルをドロップしてください'
              : 'ファイルをドラッグ&ドロップまたはクリックしてアップロード'}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            対応形式: {SUPPORTED_FORMATS.join(', ')}
            <br />
            最大ファイルサイズ: {formatFileSize(MAX_FILE_SIZE)}
          </Typography>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            sx={{ bgcolor: '#1ABC9C' }}
          >
            ファイルを選択
          </Button>
        </Box>
      </Paper>

      {/* エラーメッセージ */}
      {isDragReject && (
        <Alert severity="error" sx={{ mb: 2 }}>
          一部のファイルがサポートされていない形式または制限を超えています。
        </Alert>
      )}

      {/* アップロードされたファイル一覧 */}
      {files.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            アップロード済みファイル ({files.length})
          </Typography>
          <List>
            {files.map((file) => (
              <ListItem
                key={file.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <ListItemIcon>
                  {getFileIcon(file.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{file.name}</Typography>
                      <Chip
                        label={file.type.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: getFileTypeColor(file.type),
                          color: 'white',
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(file.size)} • {' '}
                        {formatDistanceToNow(file.uploadedAt, {
                          addSuffix: true,
                          locale: ja,
                        })}
                      </Typography>
                      {file.metadata && (
                        <Typography variant="caption" color="text.secondary">
                          {file.metadata.rows && `${file.metadata.rows}行`}
                          {file.metadata.columns && ` • ${file.metadata.columns.length}列`}
                        </Typography>
                      )}
                      {file.processingStatus === 'uploading' && (
                        <LinearProgress
                          variant="determinate"
                          value={file.progress || 0}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handlePreview(file)}
                      disabled={file.processingStatus === 'uploading'}
                    >
                      <PreviewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(file)}
                      disabled={!file.url}
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onFileDelete(file.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* ファイルプレビューダイアログ */}
      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          ファイルプレビュー: {previewFile?.name}
        </DialogTitle>
        <DialogContent>
          {previewFile && (
            <Box>
              <Typography variant="body2" gutterBottom>
                ファイル形式: {previewFile.type.toUpperCase()}
              </Typography>
              <Typography variant="body2" gutterBottom>
                サイズ: {formatFileSize(previewFile.size)}
              </Typography>
              {previewFile.metadata && (
                <Box>
                  {previewFile.metadata.rows && (
                    <Typography variant="body2" gutterBottom>
                      行数: {previewFile.metadata.rows}
                    </Typography>
                  )}
                  {previewFile.metadata.columns && (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        列: {previewFile.metadata.columns.join(', ')}
                      </Typography>
                    </Box>
                  )}
                  {previewFile.metadata.summary && (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        概要:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {previewFile.metadata.summary}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFile(null)}>
            閉じる
          </Button>
          {previewFile?.url && (
            <Button
              onClick={() => previewFile && handleDownload(previewFile)}
              variant="contained"
              sx={{ bgcolor: '#1ABC9C' }}
            >
              ダウンロード
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};