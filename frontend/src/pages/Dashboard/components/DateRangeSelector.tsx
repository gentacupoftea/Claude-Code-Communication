/**
 * 日付範囲選択コンポーネント
 */
import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Box,
  TextField,
  Divider,
  Typography,
} from '@mui/material';
import { CalendarToday, ArrowDropDown } from '@mui/icons-material';
import { formatDate } from '../../../utils/format';
import { useTranslation } from 'react-i18next';

interface DateRangeSelectorProps {
  value: { start: Date; end: Date };
  onChange: (start: Date, end: Date) => void;
  startIcon?: React.ReactNode;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  startIcon = <CalendarToday />,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const presets = [
    {
      label: t('dashboard.today'),
      getValue: () => {
        const today = new Date();
        return { start: today, end: today };
      },
    },
    {
      label: t('dashboard.yesterday'),
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: yesterday };
      },
    },
    {
      label: t('dashboard.lastWeek'),
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return { start, end };
      },
    },
    {
      label: t('dashboard.lastMonth'),
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        return { start, end };
      },
    },
  ];

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    const { start, end } = preset.getValue();
    onChange(start, end);
    handleClose();
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange(new Date(customStart), new Date(customEnd));
      handleClose();
    }
  };

  const formatRange = () => {
    if (value.start.toDateString() === value.end.toDateString()) {
      return formatDate(value.start, 'yyyy/MM/dd');
    }
    return `${formatDate(value.start, 'yyyy/MM/dd')} - ${formatDate(value.end, 'yyyy/MM/dd')}`;
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={startIcon}
        endIcon={<ArrowDropDown />}
        onClick={handleClick}
        sx={{ 
          minWidth: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {formatRange()}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 300, mt: 1 }
        }}
      >
        {presets.map((preset) => (
          <MenuItem key={preset.label} onClick={() => handlePresetClick(preset)}>
            {preset.label}
          </MenuItem>
        ))}
        
        <Divider sx={{ my: 1 }} />
        
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('dashboard.customRange')}
          </Typography>
          <TextField
            fullWidth
            type="date"
            size="small"
            label={t('dashboard.from')}
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            type="date"
            size="small"
            label={t('dashboard.to')}
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1 }}
          />
          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
          >
            {t('common.apply')}
          </Button>
        </Box>
      </Menu>
    </>
  );
};