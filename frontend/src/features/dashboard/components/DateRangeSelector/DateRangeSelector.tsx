import React, { useState } from 'react';
import { Box, Button, Stack, Paper, Typography, Chip } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarToday, 
  DateRange, 
  TrendingUp,
  AutoAwesome,
  Schedule,
  Today
} from '@mui/icons-material';

interface DateRangeSelectorProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
}

interface PresetPeriod {
  label: string;
  icon: React.ReactNode;
  getValue: () => { start: Date; end: Date };
  color: string;
}

const presetPeriods: PresetPeriod[] = [
  {
    label: '今日',
    icon: <Today />,
    getValue: () => ({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    }),
    color: '#00ff88',
  },
  {
    label: '昨日',
    icon: <Schedule />,
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 1)),
      end: endOfDay(subDays(new Date(), 1)),
    }),
    color: '#ff0088',
  },
  {
    label: '過去7日間',
    icon: <DateRange />,
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 6)),
      end: endOfDay(new Date()),
    }),
    color: '#00aaff',
  },
  {
    label: '過去30日間',
    icon: <TrendingUp />,
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 29)),
      end: endOfDay(new Date()),
    }),
    color: '#ffaa00',
  },
  {
    label: '今月',
    icon: <CalendarToday />,
    getValue: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
    color: '#aa00ff',
  },
  {
    label: '先月',
    icon: <AutoAwesome />,
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    },
    color: '#ff3366',
  },
];

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  const handlePresetClick = (preset: PresetPeriod) => {
    const { start, end } = preset.getValue();
    onStartDateChange(start);
    onEndDateChange(end);
  };

  const isPresetActive = (preset: PresetPeriod) => {
    if (!startDate || !endDate) return false;
    const { start, end } = preset.getValue();
    return (
      format(startDate, 'yyyy-MM-dd') === format(start, 'yyyy-MM-dd') &&
      format(endDate, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, rgba(255, 0, 136, 0.05) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 80%, rgba(0, 255, 136, 0.15) 0%, transparent 50%)',
              pointerEvents: 'none',
            },
          }}
        >
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: 3,
              background: 'linear-gradient(135deg, #00ff88 0%, #ff0088 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}
          >
            期間選択
          </Typography>
          
          <Stack spacing={4}>
            <Stack direction="row" spacing={3} alignItems="center">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <DatePicker
                  label="開始日"
                  value={startDate}
                  onChange={onStartDateChange}
                  slotProps={{
                    textField: {
                      size: 'medium',
                      sx: {
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(255, 255, 255, 0.05)',
                          '&:hover': {
                            background: 'rgba(0, 255, 136, 0.1)',
                          },
                        },
                      },
                    },
                  }}
                />
              </motion.div>
              
              <motion.div
                animate={{ x: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    px: 2,
                    color: '#00ff88',
                    fontWeight: 300,
                  }}
                >
                  〜
                </Typography>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <DatePicker
                  label="終了日"
                  value={endDate}
                  onChange={onEndDateChange}
                  slotProps={{
                    textField: {
                      size: 'medium',
                      sx: {
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(255, 255, 255, 0.05)',
                          '&:hover': {
                            background: 'rgba(255, 0, 136, 0.1)',
                          },
                        },
                      },
                    },
                  }}
                />
              </motion.div>
            </Stack>
            
            <Box>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  mb: 2, 
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <AutoAwesome sx={{ fontSize: 20, color: '#00ff88' }} />
                クイック選択
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <AnimatePresence>
                  {presetPeriods.map((preset, index) => (
                    <motion.div
                      key={preset.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onHoverStart={() => setHoveredPreset(preset.label)}
                      onHoverEnd={() => setHoveredPreset(null)}
                    >
                      <Chip
                        icon={preset.icon}
                        label={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        sx={{
                          height: 48,
                          px: 2,
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          background: isPresetActive(preset)
                            ? `linear-gradient(135deg, ${preset.color} 0%, ${preset.color}88 100%)`
                            : 'rgba(255, 255, 255, 0.05)',
                          border: `2px solid ${isPresetActive(preset) ? preset.color : 'rgba(255, 255, 255, 0.1)'}`,
                          color: isPresetActive(preset) ? '#000' : '#fff',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: 'pointer',
                          '& .MuiChip-icon': {
                            color: isPresetActive(preset) ? '#000' : preset.color,
                          },
                          '&:hover': {
                            background: `linear-gradient(135deg, ${preset.color}33 0%, ${preset.color}11 100%)`,
                            border: `2px solid ${preset.color}`,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 24px ${preset.color}33`,
                          },
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
            </Box>

            {startDate && endDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(255, 0, 136, 0.1) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    選択期間: <strong>{format(startDate, 'yyyy年MM月dd日', { locale: ja })}</strong> 〜 
                    <strong>{format(endDate, 'yyyy年MM月dd日', { locale: ja })}</strong>
                  </Typography>
                </Box>
              </motion.div>
            )}
          </Stack>
        </Paper>
      </motion.div>
    </LocalizationProvider>
  );
};