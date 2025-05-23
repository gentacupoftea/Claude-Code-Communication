/**
 * 表示設定コンポーネント
 * 
 * テーマ、レイアウト、アニメーションなどの視覚的な設定
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Tabs,
  Tab,
  Divider,
  Stack,
  Chip,
  Alert,
} from '@mui/material';
import {
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  FormatSize as FontSizeIcon,
  Dashboard as DashboardIcon,
  ViewCompact as CompactIcon,
  Animation as AnimationIcon,
  Palette as PaletteIcon,
  Check as CheckIcon,
  FormatColorFill as ColorFillIcon,
  BorderAll,
  BorderStyle,
  Splitscreen,
  GridView,
  TableChart,
  RestartAlt,
} from '@mui/icons-material';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '@mui/material/styles';

// カラーパレットオプション
interface ColorOption {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
}

const colorOptions: ColorOption[] = [
  {
    name: 'ブルー',
    colors: {
      primary: '#1976d2',
      secondary: '#9c27b0',
      background: '#f5f5f5',
    },
  },
  {
    name: 'グリーン',
    colors: {
      primary: '#2e7d32',
      secondary: '#f57c00',
      background: '#f9fbe7',
    },
  },
  {
    name: 'パープル',
    colors: {
      primary: '#673ab7',
      secondary: '#00bcd4',
      background: '#f3e5f5',
    },
  },
  {
    name: 'ティール',
    colors: {
      primary: '#00796b',
      secondary: '#e91e63',
      background: '#e0f2f1',
    },
  },
  {
    name: 'ダーク',
    colors: {
      primary: '#455a64',
      secondary: '#ff5722',
      background: '#37474f',
    },
  },
];

const AppearanceSettings: React.FC = () => {
  const theme = useTheme();
  const { 
    theme: themeMode, 
    compactMode, 
    animations,
    setThemeMode,
    setCompactModePreference,
    setAnimationsPreference,
  } = useSettings();
  
  const [activeTab, setActiveTab] = useState(0);
  const [selectedColorOption, setSelectedColorOption] = useState(0);
  const [fontSize, setFontSize] = useState(14);
  const [density, setDensity] = useState('comfortable');
  const [borderRadius, setBorderRadius] = useState(4);
  const [chartColorScheme, setChartColorScheme] = useState('default');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // テーマ切り替え
  const handleThemeChange = () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
  };
  
  // タブ切り替え
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // カラーオプション選択
  const handleColorOptionSelect = (index: number) => {
    setSelectedColorOption(index);
    // 実際のアプリケーションでは、ここでカラーテーマを適用する処理を行う
  };
  
  // 全ての変更を保存
  const handleSaveChanges = () => {
    // 実際のアプリケーションでは、ここで全ての設定を保存する処理を行う
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };
  
  // カスタム設定をリセット
  const handleResetCustomSettings = () => {
    setFontSize(14);
    setBorderRadius(4);
    setSelectedColorOption(0);
    setDensity('comfortable');
  };
  
  return (
    <Box>
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          表示設定が保存されました
        </Alert>
      )}
      
      <Box sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="テーマ" />
          <Tab label="レイアウト" />
          <Tab label="カスタマイズ" />
        </Tabs>
        
        {/* テーマ設定 */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DarkIcon />
                    カラーモード
                  </Typography>
                  
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      gap: 2, 
                      mb: 2,
                      py: 2,
                    }}
                  >
                    <Paper
                      elevation={themeMode === 'light' ? 8 : 0}
                      sx={{
                        p: 2,
                        width: 150,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: themeMode === 'light' ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                        transition: 'all 0.3s',
                        position: 'relative',
                      }}
                      onClick={() => setThemeMode('light')}
                    >
                      <LightIcon sx={{ fontSize: 48, color: themeMode === 'light' ? 'primary.main' : 'text.secondary' }} />
                      <Typography variant="body1" sx={{ mt: 1 }}>ライトモード</Typography>
                      
                      {themeMode === 'light' && (
                        <Chip 
                          icon={<CheckIcon />} 
                          label="現在" 
                          color="primary" 
                          size="small" 
                          sx={{ position: 'absolute', top: -10, right: -10 }}
                        />
                      )}
                    </Paper>
                    
                    <Paper
                      elevation={themeMode === 'dark' ? 8 : 0}
                      sx={{
                        p: 2,
                        width: 150,
                        bgcolor: 'grey.900',
                        color: 'grey.300',
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: themeMode === 'dark' ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                        transition: 'all 0.3s',
                        position: 'relative',
                      }}
                      onClick={() => setThemeMode('dark')}
                    >
                      <DarkIcon sx={{ fontSize: 48, color: themeMode === 'dark' ? theme.palette.primary.main : 'inherit' }} />
                      <Typography variant="body1" sx={{ mt: 1 }}>ダークモード</Typography>
                      
                      {themeMode === 'dark' && (
                        <Chip 
                          icon={<CheckIcon />} 
                          label="現在" 
                          color="primary" 
                          size="small" 
                          sx={{ position: 'absolute', top: -10, right: -10 }}
                        />
                      )}
                    </Paper>
                  </Box>
                  
                  <Box sx={{ textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      onClick={handleThemeChange}
                      startIcon={themeMode === 'light' ? <DarkIcon /> : <LightIcon />}
                    >
                      {themeMode === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PaletteIcon />
                    カラーパレット
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    アプリケーションの主要カラーを選択します
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {colorOptions.map((option, index) => (
                      <Grid item xs={6} sm={4} md={2.4} key={option.name}>
                        <Paper
                          elevation={selectedColorOption === index ? 4 : 1}
                          sx={{
                            p: 1,
                            cursor: 'pointer',
                            border: selectedColorOption === index ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                            position: 'relative',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => handleColorOptionSelect(index)}
                        >
                          <Box sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                              <Box sx={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: '50%', 
                                bgcolor: option.colors.primary,
                                mr: 1
                              }} />
                              <Box sx={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: '50%', 
                                bgcolor: option.colors.secondary
                              }} />
                            </Box>
                            <Typography variant="body2">{option.name}</Typography>
                            
                            {selectedColorOption === index && (
                              <CheckIcon
                                sx={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  color: 'primary.main',
                                  bgcolor: 'background.paper',
                                  borderRadius: '50%',
                                  fontSize: 18,
                                }}
                              />
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Typography variant="subtitle1" gutterBottom>
                    グラフ・チャートカラー
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>データ可視化の色設定</InputLabel>
                    <Select
                      value={chartColorScheme}
                      onChange={(e) => setChartColorScheme(e.target.value as string)}
                      label="データ可視化の色設定"
                    >
                      <MenuItem value="default">デフォルト</MenuItem>
                      <MenuItem value="pastel">パステル</MenuItem>
                      <MenuItem value="vivid">ビビッド</MenuItem>
                      <MenuItem value="monochrome">モノクロ</MenuItem>
                      <MenuItem value="gradient">グラデーション</MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* レイアウト設定 */}
        {activeTab === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DashboardIcon />
                    レイアウト設定
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={compactMode}
                            onChange={(e) => setCompactModePreference(e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
                              <CompactIcon sx={{ mr: 1 }} />
                              コンパクトモード
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              UI要素を縮小してより多くの情報を表示します
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={animations}
                            onChange={(e) => setAnimationsPreference(e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
                              <AnimationIcon sx={{ mr: 1 }} />
                              アニメーション
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              UI要素のアニメーションを有効にします
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        表示密度
                      </Typography>
                      
                      <FormControl fullWidth>
                        <InputLabel>密度</InputLabel>
                        <Select
                          value={density}
                          onChange={(e) => setDensity(e.target.value as string)}
                          label="密度"
                        >
                          <MenuItem value="comfortable">標準</MenuItem>
                          <MenuItem value="compact">コンパクト</MenuItem>
                          <MenuItem value="spacious">ゆったり</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        デフォルトビュータイプ
                      </Typography>
                      
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="カード表示">
                          <IconButton color="primary">
                            <GridView />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="リスト表示">
                          <IconButton>
                            <Splitscreen />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="テーブル表示">
                          <IconButton>
                            <TableChart />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* カスタマイズ設定 */}
        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ColorFillIcon />
                      詳細カスタマイズ
                    </Typography>
                    
                    <Button
                      size="small"
                      startIcon={<RestartAlt />}
                      onClick={handleResetCustomSettings}
                    >
                      デフォルトに戻す
                    </Button>
                  </Box>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        <FontSizeIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        フォントサイズ
                      </Typography>
                      
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={fontSize}
                          onChange={(_, value) => setFontSize(value as number)}
                          min={12}
                          max={18}
                          step={1}
                          marks={[
                            { value: 12, label: '小' },
                            { value: 14, label: '標準' },
                            { value: 16, label: '大' },
                            { value: 18, label: '特大' },
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}px`}
                        />
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        <BorderStyle sx={{ verticalAlign: 'middle', mr: 1 }} />
                        角丸の半径
                      </Typography>
                      
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={borderRadius}
                          onChange={(_, value) => setBorderRadius(value as number)}
                          min={0}
                          max={16}
                          step={2}
                          marks={[
                            { value: 0, label: '角形' },
                            { value: 4, label: '標準' },
                            { value: 8, label: '丸め' },
                            { value: 16, label: '丸形' },
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}px`}
                        />
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle1" gutterBottom>
                        <BorderAll sx={{ verticalAlign: 'middle', mr: 1 }} />
                        コンポーネントの枠線
                      </Typography>
                      
                      <FormControl fullWidth>
                        <InputLabel>枠線スタイル</InputLabel>
                        <Select
                          value="subtle"
                          label="枠線スタイル"
                        >
                          <MenuItem value="none">なし</MenuItem>
                          <MenuItem value="subtle">控えめ</MenuItem>
                          <MenuItem value="standard">標準</MenuItem>
                          <MenuItem value="bold">太め</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="contained"
                      onClick={handleSaveChanges}
                    >
                      カスタム設定を保存
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default AppearanceSettings;