import React from 'react';
import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { subDays, startOfMonth, startOfYear } from 'date-fns';

interface DateRangeSelectorProps {
  onChange: (startDate: Date, endDate: Date) => void;
  value?: string | { start: Date; end: Date };
  startIcon?: React.ReactNode;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ onChange, value = '7d' }) => {
  const currentValue = typeof value === 'string' ? value : '7d';
  const handleChange = (event: React.MouseEvent<HTMLElement>, newValue: string | null) => {
    if (!newValue) return;

    const endDate = new Date();
    let startDate: Date;

    switch (newValue) {
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case 'month':
        startDate = startOfMonth(endDate);
        break;
      case 'year':
        startDate = startOfYear(endDate);
        break;
      default:
        startDate = subDays(endDate, 7);
    }

    onChange(startDate, endDate);
  };

  return (
    <Box>
      <ToggleButtonGroup
        value={currentValue}
        exclusive
        onChange={handleChange}
        size="small"
      >
        <ToggleButton value="7d">7 Days</ToggleButton>
        <ToggleButton value="30d">30 Days</ToggleButton>
        <ToggleButton value="month">This Month</ToggleButton>
        <ToggleButton value="year">This Year</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};