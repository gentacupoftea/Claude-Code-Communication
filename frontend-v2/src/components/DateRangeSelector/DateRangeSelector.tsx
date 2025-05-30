'use client';

import React from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Box, TextField, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ja';

dayjs.locale('ja');

const StyledDatePicker = styled(DatePicker)(({ theme }) => ({
  '& .MuiInputBase-root': {
    borderRadius: '8px',
    '&:hover fieldset': {
      borderColor: '#34d399',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#34d399',
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#34d399',
  },
}));

interface DateRangeSelectorProps {
  startDate?: Dayjs | null;
  endDate?: Dayjs | null;
  onChange?: (startDate: Dayjs | null, endDate: Dayjs | null) => void;
  minDate?: Dayjs;
  maxDate?: Dayjs;
  disabled?: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate = null,
  endDate = null,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}) => {
  const [start, setStart] = React.useState<Dayjs | null>(startDate);
  const [end, setEnd] = React.useState<Dayjs | null>(endDate);

  const handleStartDateChange = (newValue: Dayjs | null) => {
    setStart(newValue);
    if (onChange) {
      onChange(newValue, end);
    }
  };

  const handleEndDateChange = (newValue: Dayjs | null) => {
    setEnd(newValue);
    if (onChange) {
      onChange(start, newValue);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
      <Stack direction="row" spacing={2} alignItems="center">
        <StyledDatePicker
          label="開始日"
          value={start}
          onChange={handleStartDateChange}
          minDate={minDate}
          maxDate={end || maxDate}
          disabled={disabled}
          format="YYYY/MM/DD"
          slotProps={{
            textField: {
              variant: 'outlined',
              fullWidth: true,
            },
          }}
        />
        <Box sx={{ color: '#666' }}>〜</Box>
        <StyledDatePicker
          label="終了日"
          value={end}
          onChange={handleEndDateChange}
          minDate={start || minDate}
          maxDate={maxDate}
          disabled={disabled}
          format="YYYY/MM/DD"
          slotProps={{
            textField: {
              variant: 'outlined',
              fullWidth: true,
            },
          }}
        />
      </Stack>
    </LocalizationProvider>
  );
};

export default DateRangeSelector;