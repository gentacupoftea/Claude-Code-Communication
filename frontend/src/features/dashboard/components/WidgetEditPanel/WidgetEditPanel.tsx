import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ColorPicker,
  Button,
  Divider,
  Chip,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Tune as TuneIcon,
  DataUsage as DataIcon,
  Preview as PreviewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { updateWidget } from '../../store/dashboardSlice';

interface WidgetEditPanelProps {
  widgetId: string;
  onClose: () => void;
  isFullscreen?: boolean;
}

const sizePresets = [
  { name: '小', w: 2, h: 2 },
  { name: '中', w: 4, h: 3 },
  { name: '大', w: 6, h: 4 },
  { name: '特大', w: 8, h: 6 },
];

const colorPresets = [
  '#34D399', '#60A5FA', '#F472B6', '#A78BFA',
  '#FBBF24', '#EF4444', '#10B981', '#06B6D4',
];

export const WidgetEditPanel: React.FC<WidgetEditPanelProps> = ({
  widgetId,
  onClose,
  isFullscreen = false,
}) => {
  const dispatch = useDispatch();
  const widget = useSelector((state: RootState) => 
    state.dashboard.currentDashboard?.widgets.find(w => w.id === widgetId)
  );

  const [localConfig, setLocalConfig] = useState(widget?.config || {});
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (widget) {
      setLocalConfig(widget.config);
    }
  }, [widget]);

  const handleConfigChange = (path: string, value: any) => {
    const newConfig = { ...localConfig };
    const keys = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setLocalConfig(newConfig);
    
    // リアルタイム更新
    dispatch(updateWidget({
      id: widgetId,
      updates: { config: newConfig },
    }));
  };

  const handleSizeChange = (preset: typeof sizePresets[0]) => {
    if (widget) {
      dispatch(updateWidget({
        id: widgetId,
        updates: {
          layout: {
            ...widget.layout,
            w: preset.w,
            h: preset.h,
          },
        },
      }));
    }
  };

  if (!widget) {
    return null;
  }

  return (
    <motion.div
      initial={{ x: isFullscreen ? -400 : 0, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isFullscreen ? -400 : 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <Box
        sx={{
          width: isFullscreen ? '400px' : '100%',
          height: isFullscreen ? '100vh' : 'auto',
          background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: isFullscreen ? '1px solid rgba(52, 211, 153, 0.2)' : 'none',
          borderRadius: isFullscreen ? '0 8px 8px 0' : 0,
          position: isFullscreen ? 'fixed' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? 0 : 'auto',
          zIndex: isFullscreen ? 1000 : 'auto',
          overflow: 'auto',
        }}
      >
        {/* ヘッダー */}
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box display="flex" alignItems="center">
            <SettingsIcon sx={{ mr: 2, color: '#34D399' }} />
            <Typography variant="h6" color="#FFFFFF" fontWeight="bold">
              ウィジェット設定
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="プレビューモード">
              <IconButton
                onClick={() => setPreviewMode(!previewMode)}
                sx={{
                  color: previewMode ? '#34D399' : '#9CA3AF',
                  backgroundColor: previewMode ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                }}
              >
                <PreviewIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={onClose}
              sx={{
                color: '#9CA3AF',
                '&:hover': {
                  color: '#34D399',
                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* 基本設定 */}
          <Accordion
            defaultExpanded
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 2,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#34D399' }} />}>
              <Typography color="#FFFFFF" fontWeight="bold">
                基本設定
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="タイトル"
                    value={localConfig.title || ''}
                    onChange={(e) => handleConfigChange('title', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '& fieldset': {
                          borderColor: 'rgba(52, 211, 153, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(52, 211, 153, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#34D399',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#9CA3AF',
                      },
                      '& .MuiInputBase-input': {
                        color: '#FFFFFF',
                      },
                    }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="#9CA3AF" gutterBottom>
                    サイズプリセット
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {sizePresets.map((preset) => (
                      <Chip
                        key={preset.name}
                        label={`${preset.name} (${preset.w}×${preset.h})`}
                        variant="outlined"
                        onClick={() => handleSizeChange(preset)}
                        sx={{
                          color: '#FFFFFF',
                          borderColor: '#34D399',
                          '&:hover': {
                            backgroundColor: 'rgba(52, 211, 153, 0.1)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="#9CA3AF" gutterBottom>
                    幅
                  </Typography>
                  <Slider
                    value={widget.layout?.w || 4}
                    onChange={(_, value) => {
                      dispatch(updateWidget({
                        id: widgetId,
                        updates: {
                          layout: {
                            ...widget.layout,
                            w: value as number,
                          },
                        },
                      }));
                    }}
                    min={1}
                    max={12}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    sx={{
                      color: '#34D399',
                      '& .MuiSlider-thumb': {
                        backgroundColor: '#34D399',
                      },
                      '& .MuiSlider-track': {
                        backgroundColor: '#34D399',
                      },
                      '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="#9CA3AF" gutterBottom>
                    高さ
                  </Typography>
                  <Slider
                    value={widget.layout?.h || 4}
                    onChange={(_, value) => {
                      dispatch(updateWidget({
                        id: widgetId,
                        updates: {
                          layout: {
                            ...widget.layout,
                            h: value as number,
                          },
                        },
                      }));
                    }}
                    min={1}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    sx={{
                      color: '#34D399',
                      '& .MuiSlider-thumb': {
                        backgroundColor: '#34D399',
                      },
                      '& .MuiSlider-track': {
                        backgroundColor: '#34D399',
                      },
                      '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* スタイル設定 */}
          <Accordion
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 2,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#34D399' }} />}>
              <Box display="flex" alignItems="center">
                <PaletteIcon sx={{ mr: 1, color: '#F472B6' }} />
                <Typography color="#FFFFFF" fontWeight="bold">
                  スタイル設定
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="#9CA3AF" gutterBottom>
                    カラープリセット
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {colorPresets.map((color) => (
                      <Box
                        key={color}
                        onClick={() => handleConfigChange('styling.color', color)}
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: color,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: localConfig.styling?.color === color 
                            ? '3px solid #FFFFFF' 
                            : '2px solid rgba(255, 255, 255, 0.2)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            border: '3px solid #FFFFFF',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.styling?.animation || false}
                        onChange={(e) => handleConfigChange('styling.animation', e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#34D399',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#34D399',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography color="#FFFFFF">
                        アニメーション効果
                      </Typography>
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9CA3AF' }}>テーマ</InputLabel>
                    <Select
                      value={localConfig.styling?.theme || 'dark'}
                      onChange={(e) => handleConfigChange('styling.theme', e.target.value)}
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#FFFFFF',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(52, 211, 153, 0.3)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(52, 211, 153, 0.5)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#34D399',
                        },
                      }}
                    >
                      <MenuItem value="dark">ダーク</MenuItem>
                      <MenuItem value="light">ライト</MenuItem>
                      <MenuItem value="auto">自動</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* データソース設定 */}
          <Accordion
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 2,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#34D399' }} />}>
              <Box display="flex" alignItems="center">
                <DataIcon sx={{ mr: 1, color: '#60A5FA' }} />
                <Typography color="#FFFFFF" fontWeight="bold">
                  データソース
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9CA3AF' }}>データソースタイプ</InputLabel>
                    <Select
                      value={localConfig.dataSource?.type || 'api'}
                      onChange={(e) => handleConfigChange('dataSource.type', e.target.value)}
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#FFFFFF',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(52, 211, 153, 0.3)',
                        },
                      }}
                    >
                      <MenuItem value="api">API</MenuItem>
                      <MenuItem value="database">データベース</MenuItem>
                      <MenuItem value="file">ファイル</MenuItem>
                      <MenuItem value="manual">手動入力</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="データソースID"
                    value={localConfig.dataSource?.id || ''}
                    onChange={(e) => handleConfigChange('dataSource.id', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '& fieldset': {
                          borderColor: 'rgba(52, 211, 153, 0.3)',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#9CA3AF',
                      },
                      '& .MuiInputBase-input': {
                        color: '#FFFFFF',
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* インタラクション設定 */}
          <Accordion
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#34D399' }} />}>
              <Box display="flex" alignItems="center">
                <TuneIcon sx={{ mr: 1, color: '#A78BFA' }} />
                <Typography color="#FFFFFF" fontWeight="bold">
                  インタラクション
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.interactions?.tooltip || false}
                        onChange={(e) => handleConfigChange('interactions.tooltip', e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#34D399',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#34D399',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography color="#FFFFFF">
                        ツールチップ表示
                      </Typography>
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.interactions?.legend || false}
                        onChange={(e) => handleConfigChange('interactions.legend', e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#34D399',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#34D399',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography color="#FFFFFF">
                        凡例表示
                      </Typography>
                    }
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    </motion.div>
  );
};