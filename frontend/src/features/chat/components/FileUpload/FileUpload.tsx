import React, { useCallback, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { FileService } from '../../../fileManager/services/fileService';

interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface FileUploadProps {
  onFilesUploaded: (files: { name: string; content: string | ArrayBuffer }[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesUploaded,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showDropzone, setShowDropzone] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles
        .slice(0, maxFiles - uploadedFiles.length)
        .map((file) => ({
          id: `${Date.now()}_${Math.random()}`,
          file,
          progress: 0,
          status: 'uploading' as const,
        }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      const uploadedContents: { name: string; content: string | ArrayBuffer }[] = [];

      for (const uploadFile of newFiles) {
        try {
          // ファイルサイズチェック
          if (uploadFile.file.size > maxSizeBytes) {
            throw new Error(`ファイルサイズは${FileService.formatFileSize(maxSizeBytes)}以下にしてください`);
          }

          // プログレス更新のシミュレーション
          for (let progress = 0; progress <= 100; progress += 20) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, progress } : f
              )
            );
          }

          // ファイル内容の読み込み
          const content = await readFileContent(uploadFile.file);
          uploadedContents.push({ name: uploadFile.file.name, content });

          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: 'success', progress: 100 }
                : f
            )
          );
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'アップロードに失敗しました',
                  }
                : f
            )
          );
        }
      }

      if (uploadedContents.length > 0) {
        onFilesUploaded(uploadedContents);
      }
    },
    [uploadedFiles.length, maxFiles, maxSizeBytes, onFilesUploaded]
  );

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
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: uploadedFiles.length >= maxFiles,
  });

  const readFileContent = (file: File): Promise<string | ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result);
        } else {
          reject(new Error('ファイルの読み込みに失敗しました'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      
      if (
        file.type.includes('text') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')
      ) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon sx={{ color: '#34d399' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#ef4444' }} />;
      default:
        return <FileIcon />;
    }
  };

  return (
    <Box>
      {/* ファイル添付ボタン */}
      <Tooltip title="ファイルを添付">
        <IconButton
          onClick={() => setShowDropzone(!showDropzone)}
          disabled={uploadedFiles.length >= maxFiles}
          sx={{
            color: showDropzone ? '#34d399' : 'text.secondary',
          }}
        >
          <AttachFileIcon />
        </IconButton>
      </Tooltip>

      {/* ドロップゾーン */}
      {showDropzone && (
        <Paper
          {...getRootProps()}
          sx={{
            mt: 1,
            p: 3,
            border: '2px dashed',
            borderColor: isDragActive ? '#34d399' : 'divider',
            bgcolor: isDragActive ? 'rgba(52, 211, 153, 0.05)' : 'background.paper',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {isDragActive
              ? 'ファイルをドロップしてください'
              : 'クリックまたはドラッグ&ドロップでファイルを選択'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            対応形式: CSV, Excel, PDF, TXT, MD
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            最大{maxFiles}ファイル、各{FileService.formatFileSize(maxSizeBytes)}まで
          </Typography>
        </Paper>
      )}

      {/* アップロード済みファイルリスト */}
      {uploadedFiles.length > 0 && (
        <List sx={{ mt: 1 }}>
          {uploadedFiles.map((uploadedFile) => (
            <ListItem
              key={uploadedFile.id}
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 1,
                mb: 0.5,
                px: 1,
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {getStatusIcon(uploadedFile.status)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {uploadedFile.file.name}
                    </Typography>
                    <Chip
                      label={FileService.formatFileSize(uploadedFile.file.size)}
                      size="small"
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
                secondary={
                  uploadedFile.status === 'uploading' ? (
                    <LinearProgress
                      variant="determinate"
                      value={uploadedFile.progress}
                      sx={{
                        mt: 0.5,
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#34d399',
                        },
                      }}
                    />
                  ) : uploadedFile.error ? (
                    <Typography variant="caption" color="error">
                      {uploadedFile.error}
                    </Typography>
                  ) : null
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => removeFile(uploadedFile.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};