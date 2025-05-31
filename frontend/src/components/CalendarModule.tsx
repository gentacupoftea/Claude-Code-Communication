import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface CalendarModuleProps {
  dashboardId: string;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  dashboardId,
  onDateRangeChange
}) => {
  const [startDate, setStartDate] = useState(dayjs().subtract(30, 'days'));
  const [endDate, setEndDate] = useState(dayjs());
  const [preset, setPreset] = useState('last_30_days');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // プリセット日付範囲
  const presets = [
    { value: 'today', label: '今日', days: 0 },
    { value: 'last_7_days', label: '過去7日', days: 7 },
    { value: 'last_30_days', label: '過去30日', days: 30 },
    { value: 'last_90_days', label: '過去90日', days: 90 },
    { value: 'this_month', label: '今月', days: 'month' },
    { value: 'last_month', label: '先月', days: 'last_month' },
    { value: 'this_year', label: '今年', days: 'year' },
    { value: 'custom', label: 'カスタム', days: null }
  ];

  // プリセット変更時の処理
  const handlePresetChange = (value: string) => {
    setPreset(value);
    
    const today = dayjs();
    let newStartDate = startDate;
    let newEndDate = endDate;

    switch (value) {
      case 'today':
        newStartDate = today;
        newEndDate = today;
        break;
      case 'last_7_days':
        newStartDate = today.subtract(6, 'days');
        newEndDate = today;
        break;
      case 'last_30_days':
        newStartDate = today.subtract(29, 'days');
        newEndDate = today;
        break;
      case 'last_90_days':
        newStartDate = today.subtract(89, 'days');
        newEndDate = today;
        break;
      case 'this_month':
        newStartDate = today.startOf('month');
        newEndDate = today.endOf('month');
        break;
      case 'last_month':
        newStartDate = today.subtract(1, 'month').startOf('month');
        newEndDate = today.subtract(1, 'month').endOf('month');
        break;
      case 'this_year':
        newStartDate = today.startOf('year');
        newEndDate = today.endOf('year');
        break;
      default:
        return;
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // 日付範囲をサーバーに送信
  const applyDateRange = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}/date-range`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'demo-user'
        },
        body: JSON.stringify({
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD')
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update date range');
      }

      const result = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: `日付範囲を更新しました: ${startDate.format('YYYY/MM/DD')} - ${endDate.format('YYYY/MM/DD')}` 
      });

      // 親コンポーネントに通知
      onDateRangeChange?.(
        startDate.format('YYYY-MM-DD'), 
        endDate.format('YYYY-MM-DD')
      );

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '日付範囲の更新に失敗しました' 
      });
      console.error('Date range update error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初期化時に日付範囲を適用
  useEffect(() => {
    applyDateRange();
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <CalendarTodayIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              日付範囲フィルター
            </Typography>
          </Box>

          <Box mb={2}>
            <FormControl fullWidth size="small">
              <InputLabel>プリセット</InputLabel>
              <Select
                value={preset}
                label="プリセット"
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {presets.map(p => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box display="flex" gap={2} mb={2}>
            <DatePicker
              label="開始日"
              value={startDate}
              onChange={(date) => {
                if (date) {
                  setStartDate(date);
                  setPreset('custom');
                }
              }}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="終了日"
              value={endDate}
              onChange={(date) => {
                if (date) {
                  setEndDate(date);
                  setPreset('custom');
                }
              }}
              slotProps={{ textField: { size: 'small' } }}
            />
          </Box>

          <Button
            variant="contained"
            onClick={applyDateRange}
            disabled={loading}
            fullWidth
          >
            {loading ? '適用中...' : '日付範囲を適用'}
          </Button>

          {message && (
            <Alert 
              severity={message.type} 
              sx={{ mt: 2 }}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};