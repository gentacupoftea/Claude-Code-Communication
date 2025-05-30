import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { NLQueryParser } from '../../services/NLQueryParser';
import { ChartSuggestion } from '../../types';

interface NaturalLanguageQueryProps {
  open: boolean;
  onClose: () => void;
  onCreateWidget: (config: any) => void;
}

export const NaturalLanguageQuery: React.FC<NaturalLanguageQueryProps> = ({
  open,
  onClose,
  onCreateWidget,
}) => {
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const parser = new NLQueryParser();

  const examples = [
    '売上の月別推移を表示',
    '地域別の売上を比較',
    '商品カテゴリ別の売上構成比',
    '今月のKPIダッシュボード',
    '顧客数の推移と予測',
  ];

  const handleAnalyze = useCallback(async () => {
    if (!query.trim()) return;

    setProcessing(true);
    setActiveStep(1);

    try {
      // 自然言語解析
      const nlQuery = parser.parse(query);
      setSuggestions(nlQuery.suggestions || []);
      
      // 仮のデータソース設定
      if (nlQuery.suggestions && nlQuery.suggestions.length > 0) {
        setSelectedSuggestion(0);
      }
    } catch (error) {
      console.error('Query analysis error:', error);
    } finally {
      setProcessing(false);
    }
  }, [query]);

  const handleCreateWidget = useCallback(() => {
    if (selectedSuggestion === null || !suggestions[selectedSuggestion]) return;

    const suggestion = suggestions[selectedSuggestion];
    const config = {
      type: suggestion.type,
      title: query,
      dataSource: {
        id: 'demo-data',
        type: 'api' as const,
        endpoint: '/api/demo-data',
      },
      dimensions: ['date'],
      measures: [
        {
          field: 'value',
          aggregation: 'sum' as const,
        },
      ],
      styling: {
        theme: 'light' as const,
        animation: true,
      },
      interactions: {
        tooltip: true,
        legend: true,
        zoom: suggestion.type === 'line-chart',
      },
      defaultSize: getDefaultSize(suggestion.type),
    };

    onCreateWidget(config);
    handleReset();
    onClose();
  }, [selectedSuggestion, suggestions, query, onCreateWidget, onClose]);

  const handleReset = () => {
    setQuery('');
    setSuggestions([]);
    setSelectedSuggestion(null);
    setActiveStep(0);
  };

  const getDefaultSize = (type: string) => {
    switch (type) {
      case 'kpi-card':
        return { w: 3, h: 2 };
      case 'pie-chart':
        return { w: 4, h: 4 };
      case 'line-chart':
      case 'bar-chart':
        return { w: 6, h: 4 };
      default:
        return { w: 4, h: 4 };
    }
  };

  const steps = ['クエリ入力', 'AI分析', 'ウィジェット作成'];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 500,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AutoAwesomeIcon color="primary" />
            <Typography variant="h6">自然言語でウィジェットを作成</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            placeholder="例：売上の月別推移を表示してください"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ mb: 2 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />

          <Box mb={2}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              クエリ例：
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {examples.map((example, index) => (
                <Chip
                  key={index}
                  label={example}
                  size="small"
                  onClick={() => setQuery(example)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {processing && (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          )}

          {suggestions.length > 0 && !processing && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                推奨されるビジュアライゼーション：
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                {suggestions.map((suggestion, index) => (
                  <Card
                    key={index}
                    variant={selectedSuggestion === index ? 'elevation' : 'outlined'}
                    sx={{
                      cursor: 'pointer',
                      border:
                        selectedSuggestion === index
                          ? '2px solid #3498db'
                          : '1px solid #e0e0e0',
                    }}
                    onClick={() => setSelectedSuggestion(index)}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AnalyticsIcon color="primary" />
                        <Typography variant="h6">
                          {getChartTypeName(suggestion.type)}
                        </Typography>
                        <Chip
                          label={`信頼度: ${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary" mt={1}>
                        {suggestion.reason}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} disabled={processing}>
          リセット
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        {activeStep === 0 ? (
          <Button
            onClick={handleAnalyze}
            variant="contained"
            disabled={!query.trim() || processing}
          >
            分析
          </Button>
        ) : (
          <Button
            onClick={handleCreateWidget}
            variant="contained"
            disabled={selectedSuggestion === null}
          >
            作成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

function getChartTypeName(type: string): string {
  const names: Record<string, string> = {
    'line-chart': '折れ線グラフ',
    'bar-chart': '棒グラフ',
    'pie-chart': '円グラフ',
    'scatter-chart': '散布図',
    'heatmap': 'ヒートマップ',
    'gauge': 'ゲージ',
    'kpi-card': 'KPIカード',
    'data-table': 'データテーブル',
    'map': '地図',
  };
  return names[type] || type;
}