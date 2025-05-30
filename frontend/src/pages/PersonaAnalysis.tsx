import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControlLabel,
  Checkbox,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  VideoLibrary as VideoIcon,
  Description as DocumentIcon,
  Assessment as AnalysisIcon,
  GetApp as DownloadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Psychology as PsychologyIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

interface AnalysisOptions {
  includeEmotionAnalysis: boolean;
  includeSentimentAnalysis: boolean;
  includePersonalityTraits: boolean;
  includeBehaviorPatterns: boolean;
  generateDetailedReport: boolean;
}

interface AnalysisResult {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  reportUrl?: string;
  summary?: {
    dominantPersonality: string;
    keyInsights: string[];
    recommendations: string[];
  };
}

export const PersonaAnalysis: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>({
    includeEmotionAnalysis: true,
    includeSentimentAnalysis: true,
    includePersonalityTraits: true,
    includeBehaviorPatterns: true,
    generateDetailedReport: true,
  });
  const [targetAudience, setTargetAudience] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const steps = ['ファイルアップロード', '分析オプション設定', '分析実行', '結果確認'];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    enqueueSnackbar(`${acceptedFiles.length}個のファイルをアップロードしました`, {
      variant: 'success',
    });
  }, [enqueueSnackbar]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv'],
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('video/')) return <VideoIcon />;
    return <DocumentIcon />;
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      enqueueSnackbar('ファイルをアップロードしてください', { variant: 'error' });
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();

    // ファイルの追加
    uploadedFiles.forEach((file) => {
      if (file.type.startsWith('video/')) {
        formData.append('videos', file.file);
      } else if (file.name.includes('transcript')) {
        formData.append('transcript', file.file);
      } else if (file.name.includes('survey')) {
        formData.append('survey', file.file);
      } else if (file.name.includes('purchase')) {
        formData.append('purchase_data', file.file);
      }
    });

    // オプションの追加
    formData.append('options', JSON.stringify(analysisOptions));
    formData.append('targetAudience', targetAudience);

    try {
      const response = await axios.post('/api/persona-analysis/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5分のタイムアウト
      });

      setAnalysisResult(response.data);
      enqueueSnackbar('分析を開始しました', { variant: 'success' });
      handleNext();
      
      // ステータスのポーリング
      pollAnalysisStatus(response.data.id);
    } catch (error) {
      console.error('Analysis error:', error);
      enqueueSnackbar('分析の開始に失敗しました', { variant: 'error' });
      setIsAnalyzing(false);
    }
  };

  const pollAnalysisStatus = async (analysisId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/persona-analysis/analyses/${analysisId}/status`);
        const { status, progress } = response.data;

        setAnalysisResult((prev) => ({
          ...prev!,
          status,
          progress,
        }));

        if (status === 'completed' || status === 'failed') {
          clearInterval(interval);
          setIsAnalyzing(false);

          if (status === 'completed') {
            const fullResult = await axios.get(`/api/persona-analysis/analyses/${analysisId}`);
            setAnalysisResult(fullResult.data);
            enqueueSnackbar('分析が完了しました', { variant: 'success' });
          } else {
            enqueueSnackbar('分析に失敗しました', { variant: 'error' });
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
        clearInterval(interval);
        setIsAnalyzing(false);
      }
    }, 5000); // 5秒ごとにステータスを確認
  };

  const downloadReport = async () => {
    if (!analysisResult?.reportUrl) return;

    try {
      const response = await axios.get(analysisResult.reportUrl, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `persona-analysis-${analysisResult.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      enqueueSnackbar('レポートをダウンロードしました', { variant: 'success' });
    } catch (error) {
      console.error('Download error:', error);
      enqueueSnackbar('レポートのダウンロードに失敗しました', { variant: 'error' });
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.3s',
              }}
            >
              <input {...getInputProps()} />
              <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isDragActive
                  ? 'ファイルをドロップしてください'
                  : 'ファイルをドラッグ＆ドロップまたはクリックして選択'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                対応形式: 動画ファイル (MP4, AVI, MOV), PDF, CSV, JSON
              </Typography>
              <Typography variant="caption" color="text.secondary">
                最大ファイルサイズ: 500MB
              </Typography>
            </Box>

            {uploadedFiles.length > 0 && (
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>
                  アップロードされたファイル
                </Typography>
                <List>
                  {uploadedFiles.map((file) => (
                    <ListItem
                      key={file.id}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => removeFile(file.id)}>
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>{getFileIcon(file.type)}</ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={formatFileSize(file.size)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              分析オプション
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={analysisOptions.includeEmotionAnalysis}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          includeEmotionAnalysis: e.target.checked,
                        })
                      }
                    />
                  }
                  label="感情分析を含める"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={analysisOptions.includeSentimentAnalysis}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          includeSentimentAnalysis: e.target.checked,
                        })
                      }
                    />
                  }
                  label="センチメント分析を含める"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={analysisOptions.includePersonalityTraits}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          includePersonalityTraits: e.target.checked,
                        })
                      }
                    />
                  }
                  label="性格特性分析を含める"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={analysisOptions.includeBehaviorPatterns}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          includeBehaviorPatterns: e.target.checked,
                        })
                      }
                    />
                  }
                  label="行動パターン分析を含める"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={analysisOptions.generateDetailedReport}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          generateDetailedReport: e.target.checked,
                        })
                      }
                    />
                  }
                  label="詳細レポートを生成する"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ターゲットオーディエンス"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例: 20-30代の女性、健康志向の高い層"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box textAlign="center" py={4}>
            {isAnalyzing ? (
              <>
                <AnalysisIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  分析中...
                </Typography>
                <Box sx={{ width: '100%', mt: 3, mb: 3 }}>
                  <LinearProgress
                    variant="determinate"
                    value={analysisResult?.progress || 0}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {analysisResult?.progress || 0}% 完了
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  分析の準備が整いました
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  以下の内容で分析を開始します：
                </Typography>
                <Box mt={2}>
                  <Chip label={`${uploadedFiles.length}個のファイル`} sx={{ m: 0.5 }} />
                  {analysisOptions.includeEmotionAnalysis && (
                    <Chip label="感情分析" sx={{ m: 0.5 }} />
                  )}
                  {analysisOptions.includeSentimentAnalysis && (
                    <Chip label="センチメント分析" sx={{ m: 0.5 }} />
                  )}
                  {analysisOptions.includePersonalityTraits && (
                    <Chip label="性格特性分析" sx={{ m: 0.5 }} />
                  )}
                  {analysisOptions.includeBehaviorPatterns && (
                    <Chip label="行動パターン分析" sx={{ m: 0.5 }} />
                  )}
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AnalysisIcon />}
                  onClick={startAnalysis}
                  sx={{ mt: 3 }}
                >
                  分析を開始
                </Button>
              </>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            {analysisResult?.status === 'completed' ? (
              <>
                <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 3 }}>
                  分析が完了しました
                </Alert>
                {analysisResult.summary && (
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            <PsychologyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            主要なペルソナタイプ
                          </Typography>
                          <Typography variant="h4" color="primary">
                            {analysisResult.summary.dominantPersonality}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            主要な洞察
                          </Typography>
                          <List>
                            {analysisResult.summary.keyInsights.map((insight, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={insight} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            推奨アクション
                          </Typography>
                          <List>
                            {analysisResult.summary.recommendations.map((rec, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={rec} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Box textAlign="center">
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<DownloadIcon />}
                          onClick={downloadReport}
                        >
                          詳細レポートをダウンロード
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                )}
              </>
            ) : analysisResult?.status === 'failed' ? (
              <Alert severity="error" icon={<ErrorIcon />}>
                分析に失敗しました。もう一度お試しください。
              </Alert>
            ) : (
              <Box textAlign="center" py={4}>
                <CircularProgress />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  分析結果を取得中...
                </Typography>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <PsychologyIcon sx={{ mr: 2, fontSize: 40 }} />
          ペルソナ分析
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          動画、文書、購買データなどから顧客のペルソナを詳細に分析します
        </Typography>

        <Paper elevation={3} sx={{ p: 4, mt: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Divider sx={{ mb: 3 }} />

          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              戻る
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                (activeStep === 0 && uploadedFiles.length === 0) ||
                activeStep === steps.length - 1 ||
                isAnalyzing
              }
            >
              次へ
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};