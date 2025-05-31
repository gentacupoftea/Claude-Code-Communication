import React, { useRef, useEffect, useState } from 'react';
import * as fabric from 'fabric';
import {
  Box,
  Paper,
  Stack,
  Button,
  ButtonGroup,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Fab,
  Zoom,
} from '@mui/material';
import {
  TextFields,
  CropSquare,
  RadioButtonUnchecked,
  Timeline,
  Palette,
  Save,
  FileDownload,
  Undo,
  Redo,
  Delete,
  Brush,
  Layers,
  FormatColorFill,
  BorderColor,
  CloudUpload,
  AutoFixHigh,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface CanvasEditorProps {
  width?: number;
  height?: number;
}

const NEON_COLORS = [
  { name: 'Cyber Green', value: '#00ff88' },
  { name: 'Hot Pink', value: '#ff0088' },
  { name: 'Electric Blue', value: '#00aaff' },
  { name: 'Sunset Orange', value: '#ffaa00' },
  { name: 'Ultra Violet', value: '#aa00ff' },
  { name: 'Laser Red', value: '#ff3366' },
  { name: 'Pure White', value: '#ffffff' },
  { name: 'Deep Black', value: '#000000' },
];

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState('#00ff88');
  const [colorAnchorEl, setColorAnchorEl] = useState<null | HTMLElement>(null);
  const [exportMenuAnchorEl, setExportMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [textValue, setTextValue] = useState('');
  const [textAnchorEl, setTextAnchorEl] = useState<null | HTMLElement>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (canvasRef.current) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor: '#0a0a0a',
      });
      setCanvas(fabricCanvas);

      fabricCanvas.on('path:created', () => saveHistory(fabricCanvas));
      fabricCanvas.on('object:modified', () => saveHistory(fabricCanvas));
      fabricCanvas.on('object:added', () => saveHistory(fabricCanvas));

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const activeObject = fabricCanvas.getActiveObject();
          if (activeObject) {
            fabricCanvas.remove(activeObject);
            fabricCanvas.renderAll();
          }
        }
        if (e.ctrlKey && e.key === 'z') {
          handleUndo();
        }
        if (e.ctrlKey && e.key === 'y') {
          handleRedo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        fabricCanvas.dispose();
      };
    }
  }, [width, height]);

  const saveHistory = (fabricCanvas: fabric.Canvas) => {
    const newHistory = [...history.slice(0, historyIndex + 1), JSON.stringify(fabricCanvas.toJSON())];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (canvas && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      canvas.loadFromJSON(history[newIndex], () => {
        canvas.renderAll();
        setHistoryIndex(newIndex);
      });
    }
  };

  const handleRedo = () => {
    if (canvas && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      canvas.loadFromJSON(history[newIndex], () => {
        canvas.renderAll();
        setHistoryIndex(newIndex);
      });
    }
  };

  const toggleDrawingMode = () => {
    if (canvas) {
      canvas.isDrawingMode = !isDrawingMode;
      canvas.freeDrawingBrush.color = selectedColor;
      canvas.freeDrawingBrush.width = strokeWidth;
      setIsDrawingMode(!isDrawingMode);
    }
  };

  const addText = () => {
    if (canvas && textValue) {
      const text = new fabric.Text(textValue, {
        left: Math.random() * (width - 200) + 100,
        top: Math.random() * (height - 100) + 50,
        fill: selectedColor,
        fontSize: 32,
        fontFamily: 'SF Pro Display',
        fontWeight: 'bold',
        shadow: `0 0 20px ${selectedColor}`,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
      setTextValue('');
      setTextAnchorEl(null);
    }
  };

  const addShape = (type: 'rect' | 'circle' | 'line') => {
    if (!canvas) return;

    let shape: fabric.Object;
    const commonProps = {
      left: Math.random() * (width - 200) + 100,
      top: Math.random() * (height - 200) + 100,
      fill: 'transparent',
      stroke: selectedColor,
      strokeWidth: 3,
      shadow: `0 0 30px ${selectedColor}`,
    };

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          ...commonProps,
          width: 150,
          height: 150,
          rx: 10,
          ry: 10,
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          ...commonProps,
          radius: 75,
        });
        break;
      case 'line':
        shape = new fabric.Line([0, 0, 200, 0], {
          ...commonProps,
          left: commonProps.left,
          top: commonProps.top,
        });
        break;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (canvas) {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        if (activeObject.type === 'text' || activeObject.type === 'i-text') {
          activeObject.set({ 
            fill: color,
            shadow: `0 0 20px ${color}`,
          });
        } else if (activeObject.type === 'line') {
          activeObject.set({ 
            stroke: color,
            shadow: `0 0 30px ${color}`,
          });
        } else {
          activeObject.set({ 
            stroke: color,
            shadow: `0 0 30px ${color}`,
          });
        }
        canvas.renderAll();
      }
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.color = color;
      }
    }
    setColorAnchorEl(null);
  };

  const deleteSelected = () => {
    if (canvas) {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.remove(activeObject);
        canvas.renderAll();
      }
    }
  };

  const exportAs = (format: 'png' | 'jpeg' | 'json') => {
    if (canvas) {
      if (format === 'json') {
        const json = JSON.stringify(canvas.toJSON());
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canvas-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const dataURL = canvas.toDataURL({
          format,
          quality: 1,
        });
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `canvas-${new Date().getTime()}.${format}`;
        a.click();
      }
    }
    setExportMenuAnchorEl(null);
  };

  const saveCanvas = () => {
    if (canvas) {
      const json = JSON.stringify(canvas.toJSON());
      localStorage.setItem('canvas-editor-data', json);
    }
  };

  const loadCanvas = () => {
    if (canvas) {
      const savedData = localStorage.getItem('canvas-editor-data');
      if (savedData) {
        canvas.loadFromJSON(savedData, () => {
          canvas.renderAll();
        });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.03) 0%, rgba(255, 0, 136, 0.03) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <Typography 
          variant="h5" 
          gutterBottom 
          sx={{ 
            mb: 3,
            background: 'linear-gradient(135deg, #00ff88 0%, #00aaff 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <AutoFixHigh /> キャンバスエディター
        </Typography>

        <Stack spacing={3}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <ButtonGroup variant="contained" size="medium">
              <Tooltip title="テキスト追加" arrow placement="top">
                <Button
                  onClick={(e) => setTextAnchorEl(e.currentTarget)}
                  startIcon={<TextFields />}
                  sx={{
                    background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #66ffb2 0%, #00ff88 100%)',
                    },
                  }}
                >
                  テキスト
                </Button>
              </Tooltip>
              
              <Tooltip title="四角形" arrow placement="top">
                <Button
                  onClick={() => addShape('rect')}
                  sx={{
                    background: 'linear-gradient(135deg, #ff0088 0%, #cc0066 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff66b2 0%, #ff0088 100%)',
                    },
                  }}
                >
                  <CropSquare />
                </Button>
              </Tooltip>
              
              <Tooltip title="円" arrow placement="top">
                <Button
                  onClick={() => addShape('circle')}
                  sx={{
                    background: 'linear-gradient(135deg, #00aaff 0%, #0077cc 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #66ccff 0%, #00aaff 100%)',
                    },
                  }}
                >
                  <RadioButtonUnchecked />
                </Button>
              </Tooltip>
              
              <Tooltip title="線" arrow placement="top">
                <Button
                  onClick={() => addShape('line')}
                  sx={{
                    background: 'linear-gradient(135deg, #ffaa00 0%, #cc7700 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ffcc66 0%, #ffaa00 100%)',
                    },
                  }}
                >
                  <Timeline />
                </Button>
              </Tooltip>
            </ButtonGroup>

            <Tooltip title="描画モード" arrow placement="top">
              <IconButton
                onClick={toggleDrawingMode}
                sx={{
                  width: 48,
                  height: 48,
                  background: isDrawingMode 
                    ? 'linear-gradient(135deg, #aa00ff 0%, #6600cc 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: isDrawingMode 
                      ? 'linear-gradient(135deg, #cc66ff 0%, #aa00ff 100%)'
                      : 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                <Brush sx={{ color: '#fff' }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="カラーパレット" arrow placement="top">
              <IconButton
                onClick={(e) => setColorAnchorEl(e.currentTarget)}
                sx={{
                  width: 48,
                  height: 48,
                  background: selectedColor,
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: `0 0 20px ${selectedColor}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: `0 0 30px ${selectedColor}`,
                  },
                }}
              >
                <Palette sx={{ color: selectedColor === '#ffffff' ? '#000' : '#fff' }} />
              </IconButton>
            </Tooltip>

            <Box sx={{ flexGrow: 1 }} />

            <ButtonGroup variant="outlined" size="medium">
              <Tooltip title="元に戻す" arrow placement="top">
                <Button onClick={handleUndo} disabled={historyIndex <= 0}>
                  <Undo />
                </Button>
              </Tooltip>
              <Tooltip title="やり直す" arrow placement="top">
                <Button onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                  <Redo />
                </Button>
              </Tooltip>
            </ButtonGroup>

            <Tooltip title="削除" arrow placement="top">
              <IconButton
                onClick={deleteSelected}
                sx={{
                  color: '#ff3366',
                  '&:hover': {
                    background: 'rgba(255, 51, 102, 0.1)',
                  },
                }}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </Box>

          <Box
            sx={{
              position: 'relative',
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(0, 255, 136, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              background: '#000',
            }}
          >
            <canvas ref={canvasRef} />
            
            <AnimatePresence>
              {isDrawingMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    padding: '8px 16px',
                    background: 'rgba(170, 0, 255, 0.9)',
                    borderRadius: 20,
                    color: '#fff',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    boxShadow: '0 0 20px rgba(170, 0, 255, 0.5)',
                  }}
                >
                  描画モード ON
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={saveCanvas}
                size="large"
                sx={{
                  background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                  px: 4,
                }}
              >
                保存
              </Button>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outlined"
                startIcon={<FileDownload />}
                onClick={(e) => setExportMenuAnchorEl(e.currentTarget)}
                size="large"
                sx={{
                  borderColor: '#00aaff',
                  color: '#00aaff',
                  px: 4,
                  '&:hover': {
                    borderColor: '#66ccff',
                    background: 'rgba(0, 170, 255, 0.1)',
                  },
                }}
              >
                エクスポート
              </Button>
            </motion.div>
          </Box>
        </Stack>

        {/* カラーピッカー */}
        <Popover
          open={Boolean(colorAnchorEl)}
          anchorEl={colorAnchorEl}
          onClose={() => setColorAnchorEl(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              p: 3,
            },
          }}
        >
          <Typography variant="subtitle1" gutterBottom sx={{ color: '#fff', mb: 2 }}>
            カラー選択
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
            {NEON_COLORS.map((color) => (
              <Tooltip key={color.value} title={color.name} arrow placement="top">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <IconButton
                    onClick={() => handleColorChange(color.value)}
                    sx={{
                      backgroundColor: color.value,
                      width: 56,
                      height: 56,
                      border: color.value === selectedColor ? '3px solid #fff' : 'none',
                      boxShadow: `0 0 20px ${color.value}`,
                      '&:hover': {
                        boxShadow: `0 0 30px ${color.value}`,
                      },
                    }}
                  />
                </motion.div>
              </Tooltip>
            ))}
          </Box>
        </Popover>

        {/* テキスト入力 */}
        <Popover
          open={Boolean(textAnchorEl)}
          anchorEl={textAnchorEl}
          onClose={() => setTextAnchorEl(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              p: 3,
            },
          }}
        >
          <Typography variant="subtitle1" gutterBottom sx={{ color: '#fff', mb: 2 }}>
            テキストを入力
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addText();
                }
              }}
              autoFocus
              placeholder="テキストを入力..."
              sx={{
                minWidth: 300,
                '& .MuiInputBase-input': {
                  color: '#fff',
                },
              }}
            />
            <Button
              variant="contained"
              onClick={addText}
              sx={{
                background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
              }}
            >
              追加
            </Button>
          </Stack>
        </Popover>

        {/* エクスポートメニュー */}
        <Menu
          anchorEl={exportMenuAnchorEl}
          open={Boolean(exportMenuAnchorEl)}
          onClose={() => setExportMenuAnchorEl(null)}
          PaperProps={{
            sx: {
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <MenuItem onClick={() => exportAs('png')} sx={{ color: '#fff' }}>
            PNG形式でエクスポート
          </MenuItem>
          <MenuItem onClick={() => exportAs('jpeg')} sx={{ color: '#fff' }}>
            JPEG形式でエクスポート
          </MenuItem>
          <MenuItem onClick={() => exportAs('json')} sx={{ color: '#fff' }}>
            JSON形式でエクスポート
          </MenuItem>
        </Menu>
      </Paper>
    </motion.div>
  );
};