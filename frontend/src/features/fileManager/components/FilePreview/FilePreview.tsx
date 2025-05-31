import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  TableChart as TableChartIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { FileService } from '../../services/fileService';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    size?: number;
    mimeType?: string;
    content?: string | ArrayBuffer;
  };
  open: boolean;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, open, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (open && file.content) {
      loadPreview();
    }
  }, [open, file]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const category = FileService.getMimeTypeCategory(file.mimeType);
      
      switch (category) {
        case 'spreadsheet':
          if (file.name.endsWith('.csv') && typeof file.content === 'string') {
            const data = await FileService.parseCSV(file.content);
            setPreviewData(data);
          } else if (file.content instanceof ArrayBuffer) {
            const data = await FileService.parseExcel(file.content);
            setPreviewData(data);
          }
          break;
          
        case 'text':
          if (typeof file.content === 'string') {
            setPreviewData(file.content);
          }
          break;
          
        case 'pdf':
          setPreviewData('PDF プレビューは現在サポートされていません');
          break;
          
        default:
          setPreviewData('このファイル形式のプレビューはサポートされていません');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プレビューの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (file.content) {
      const blob = file.content instanceof ArrayBuffer
        ? new Blob([file.content])
        : new Blob([file.content]);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const renderSpreadsheetPreview = () => {
    if (!Array.isArray(previewData) || previewData.length === 0) {
      return <Typography>データがありません</Typography>;
    }

    const headers = Object.keys(previewData[0]);
    const rows = previewData.slice(0, 100); // 最初の100行のみ表示

    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {previewData.length} 行のデータ（最初の100行を表示）
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {headers.map((header, index) => (
                  <TableCell key={index} sx={{ bgcolor: '#f3f4f6', fontWeight: 'bold' }}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex} hover>
                  {headers.map((header, cellIndex) => (
                    <TableCell key={cellIndex}>
                      {row[header]?.toString() || ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderTextPreview = () => {
    return (
      <Box
        sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 1,
          maxHeight: 400,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {previewData}
      </Box>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Typography color="error" sx={{ p: 2 }}>
          {error}
        </Typography>
      );
    }

    const category = FileService.getMimeTypeCategory(file.mimeType);

    if (category === 'spreadsheet' && tabValue === 0) {
      return renderSpreadsheetPreview();
    } else if (category === 'spreadsheet' && tabValue === 1) {
      return renderTextPreview();
    } else if (category === 'text') {
      return renderTextPreview();
    } else {
      return (
        <Typography sx={{ p: 2 }}>
          {previewData}
        </Typography>
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">{file.name}</Typography>
          {file.size && (
            <Typography variant="caption" color="text.secondary">
              ({FileService.formatFileSize(file.size)})
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {FileService.getMimeTypeCategory(file.mimeType) === 'spreadsheet' && (
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab
              icon={<TableChartIcon />}
              label="テーブル表示"
              iconPosition="start"
            />
            <Tab
              icon={<CodeIcon />}
              label="生データ"
              iconPosition="start"
            />
          </Tabs>
        )}
        
        <Box sx={{ p: 2, height: 'calc(100% - 48px)', overflow: 'auto' }}>
          {renderContent()}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          variant="contained"
          sx={{
            bgcolor: '#34d399',
            '&:hover': { bgcolor: '#2dc08a' },
          }}
        >
          ダウンロード
        </Button>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};