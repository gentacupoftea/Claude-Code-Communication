import React, { useState } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { BigQueryApiService } from '../services/bigquery-api.service';
import { SaveChartRequest } from '../types/bigquery.types';

interface SaveChartButtonProps {
  queryData: SaveChartRequest['queryData'];
  chartData: SaveChartRequest['chartData'];
  aggregatedData: SaveChartRequest['aggregatedData'];
  onSaved?: (chartId: string) => void;
}

export const SaveChartButton: React.FC<SaveChartButtonProps> = ({
  queryData,
  chartData,
  aggregatedData,
  onSaved
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await BigQueryApiService.saveChart({
        queryData,
        chartData,
        aggregatedData
      });

      // ダッシュボードに追加
      await BigQueryApiService.addToDashboard(result.chartId);

      setMessage({ type: 'success', text: 'チャートを保存しました！' });
      onSaved?.(result.chartId);
    } catch (error) {
      setMessage({ type: 'error', text: 'チャートの保存に失敗しました' });
      console.error('Save chart error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SaveIcon />}
        onClick={handleSave}
        disabled={loading}
      >
        ダッシュボードに保存
      </Button>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
      >
        <Alert severity={message?.type} onClose={() => setMessage(null)}>
          {message?.text}
        </Alert>
      </Snackbar>
    </>
  );
};