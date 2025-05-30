import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixHighIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { GraphGeneratorService, GraphTypeAnalysis } from '../services/graphGeneratorService';
import { FileUpload } from '../../chat/components/FileUpload/FileUpload';
import { FileService } from '../../fileManager/services/fileService';

interface GraphGeneratorProps {
  initialData?: any[];
}

export const GraphGenerator: React.FC<GraphGeneratorProps> = ({ initialData }) => {
  const [prompt, setPrompt] = useState('');
  const [data, setData] = useState<any[]>(initialData || []);
  const [analysis, setAnalysis] = useState<GraphTypeAnalysis | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedGraphType, setSelectedGraphType] = useState<string>('auto');
  const [copied, setCopied] = useState(false);

  const steps = [
    'プロンプトを入力',
    'データを確認',
    'グラフタイプを選択',
    'プレビューと調整',
    'コードをエクスポート',
  ];

  const handleAnalyze = useCallback(async () => {
    if (!prompt.trim()) {
      setError('プロンプトを入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = GraphGeneratorService.analyzePrompt(prompt, data);
      setAnalysis(result);
      
      if (selectedGraphType !== 'auto') {
        result.graphType = selectedGraphType as any;
      }
      
      setActiveStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [prompt, data, selectedGraphType]);

  const handleGenerateCode = useCallback(() => {
    if (!analysis || !data.length) return;

    const generated = GraphGeneratorService.generateGraphComponent(
      analysis.graphType,
      data,
      {
        title: prompt.slice(0, 50),
      }
    );

    const fullCode = `
${generated.imports.join('\n')}

${generated.component}
`;

    setGeneratedCode(fullCode);
    setActiveStep(4);
  }, [analysis, data, prompt]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFilesUploaded = async (files: { name: string; content: string | ArrayBuffer }[]) => {
    for (const file of files) {
      try {
        let parsedData;
        
        if (file.name.endsWith('.csv') && typeof file.content === 'string') {
          parsedData = await FileService.parseCSV(file.content);
        } else if (file.content instanceof ArrayBuffer) {
          parsedData = await FileService.parseExcel(file.content);
        }
        
        if (parsedData) {
          setData(parsedData);
          setActiveStep(1);
        }
      } catch (err) {
        setError('ファイルの解析に失敗しました');
      }
    }
  };

  const renderPreview = () => {
    if (!analysis || !data.length) return null;

    const colors = ['#34d399', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    switch (analysis.graphType) {
      case 'line':
        const lineKeys = Object.keys(data[0]).filter((_, i) => i > 0);
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={Object.keys(data[0])[0]} />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              {lineKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        const barKeys = Object.keys(data[0]).filter((_, i) => i > 0);
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={Object.keys(data[0])[0]} />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              {barKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = data.map((item, index) => ({
          ...item,
          fill: colors[index % colors.length],
        }));
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                dataKey={Object.keys(data[0])[1]}
                nameKey={Object.keys(data[0])[0]}
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <Typography>プレビューを生成中...</Typography>;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#34d399' }}>
          <AutoFixHighIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          AI グラフジェネレーター
        </Typography>
        
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 3 }}>
          <Step>
            <StepLabel>プロンプトを入力</StepLabel>
            <StepContent>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="例: 売上データの月別推移を見やすく表示したい"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                  disabled={!prompt.trim()}
                  sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#2dc08a' } }}
                >
                  次へ
                </Button>
                <FileUpload onFilesUploaded={handleFilesUploaded} />
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>データを確認</StepLabel>
            <StepContent>
              {data.length > 0 ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {data.length}件のデータが読み込まれました
                  </Alert>
                  <Card sx={{ mb: 2, maxHeight: 300, overflow: 'auto' }}>
                    <CardContent>
                      <pre style={{ fontSize: '0.875rem' }}>
                        {JSON.stringify(data.slice(0, 5), null, 2)}
                      </pre>
                      {data.length > 5 && (
                        <Typography variant="caption" color="text.secondary">
                          ... 他 {data.length - 5} 件
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  データがアップロードされていません。ファイルをアップロードしてください。
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(0)}>戻る</Button>
                <Button
                  variant="contained"
                  onClick={handleAnalyze}
                  disabled={data.length === 0}
                  sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#2dc08a' } }}
                >
                  分析
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>グラフタイプを選択</StepLabel>
            <StepContent>
              {analysis && (
                <Box>
                  <Alert
                    severity={analysis.confidence > 0.7 ? 'success' : 'info'}
                    sx={{ mb: 2 }}
                  >
                    推奨: {analysis.graphType}グラフ（信頼度: {Math.round(analysis.confidence * 100)}%）
                  </Alert>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {analysis.reasoning}
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>グラフタイプ</InputLabel>
                    <Select
                      value={selectedGraphType}
                      onChange={(e) => setSelectedGraphType(e.target.value)}
                      label="グラフタイプ"
                    >
                      <MenuItem value="auto">自動選択</MenuItem>
                      <MenuItem value="line">折れ線グラフ</MenuItem>
                      <MenuItem value="bar">棒グラフ</MenuItem>
                      <MenuItem value="pie">円グラフ</MenuItem>
                      <MenuItem value="scatter">散布図</MenuItem>
                      <MenuItem value="radar">レーダーチャート</MenuItem>
                      <MenuItem value="heatmap">ヒートマップ</MenuItem>
                    </Select>
                  </FormControl>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={() => setActiveStep(1)}>戻る</Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(3)}
                      sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#2dc08a' } }}
                    >
                      次へ
                    </Button>
                  </Box>
                </Box>
              )}
            </StepContent>
          </Step>

          <Step>
            <StepLabel>プレビューと調整</StepLabel>
            <StepContent>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  {renderPreview()}
                </CardContent>
              </Card>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(2)}>戻る</Button>
                <Button
                  variant="contained"
                  onClick={handleGenerateCode}
                  sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#2dc08a' } }}
                >
                  コード生成
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>コードをエクスポート</StepLabel>
            <StepContent>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
                <Tab icon={<PreviewIcon />} label="プレビュー" />
                <Tab icon={<CodeIcon />} label="コード" />
              </Tabs>

              {tabValue === 0 && (
                <Card>
                  <CardContent>
                    {renderPreview()}
                  </CardContent>
                </Card>
              )}

              {tabValue === 1 && (
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                      <Tooltip title={copied ? 'コピーしました！' : 'コピー'}>
                        <IconButton onClick={handleCopyCode} size="small">
                          {copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box
                      sx={{
                        bgcolor: '#f3f4f6',
                        p: 2,
                        borderRadius: 1,
                        overflow: 'auto',
                        maxHeight: 400,
                      }}
                    >
                      <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                        <code>{generatedCode}</code>
                      </pre>
                    </Box>
                  </CardContent>
                </Card>
              )}

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button onClick={() => setActiveStep(3)}>戻る</Button>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    const blob = new Blob([generatedCode], { type: 'text/javascript' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'generated-chart.tsx';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#2dc08a' } }}
                >
                  ダウンロード
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>

        {loading && <LinearProgress sx={{ mt: 2 }} />}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};