import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Switch,
  FormControlLabel,
  Slider,
  TextField
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Settings,
  Download,
  Refresh,
  TrendingUp,
  BarChart,
  PieChart,
  ShowChart
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import {
  Line,
  Bar,
  Pie,
  Doughnut,
  Scatter,
  Radar
} from 'react-chartjs-2';
import * as d3 from 'd3';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale,
  Filler
);

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'heatmap' | 'treemap';
  title: string;
  data: any;
  options?: any;
  realtime?: boolean;
  updateInterval?: number;
  interactive?: boolean;
  responsive?: boolean;
}

export interface VisualizationData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    pointRadius?: number;
    [key: string]: any;
  }>;
}

export interface HeatmapData {
  xLabels: string[];
  yLabels: string[];
  data: number[][];
  colorScale?: [string, string];
}

export interface TreemapData {
  name: string;
  value?: number;
  children?: TreemapData[];
}

interface AdvancedChartSystemProps {
  config: ChartConfig;
  width?: number;
  height?: number;
  onDataUpdate?: (data: any) => void;
  onInteraction?: (event: any) => void;
}

const AdvancedChartSystem: React.FC<AdvancedChartSystemProps> = ({
  config,
  width = 800,
  height = 400,
  onDataUpdate,
  onInteraction
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ChartConfig>(config);
  const [realtimeData, setRealtimeData] = useState(config.data);
  const [customOptions, setCustomOptions] = useState({
    animation: true,
    responsive: true,
    maintainAspectRatio: false,
    showGrid: true,
    showLegend: true,
    colorScheme: 'default'
  });
  
  const chartRef = useRef<any>(null);
  const d3ContainerRef = useRef<SVGSVGElement>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Color schemes
  const colorSchemes = {
    default: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
    pastel: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc'],
    vibrant: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33'],
    cool: ['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#e6f0fd', '#f7fbff'],
    warm: ['#de2d26', '#fc9272', '#fee0d2', '#fff5f0', '#ffeda0', '#fed976']
  };

  useEffect(() => {
    setCurrentConfig(config);
    setRealtimeData(config.data);
  }, [config]);

  useEffect(() => {
    if (currentConfig.realtime && currentConfig.updateInterval) {
      realtimeIntervalRef.current = setInterval(() => {
        updateRealtimeData();
      }, currentConfig.updateInterval);
    }

    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, [currentConfig.realtime, currentConfig.updateInterval]);

  const updateRealtimeData = () => {
    if (onDataUpdate) {
      onDataUpdate(realtimeData);
    } else {
      // Simulate data update for demo
      const newData = { ...realtimeData };
      newData.datasets = newData.datasets.map((dataset: any) => ({
        ...dataset,
        data: dataset.data.map(() => Math.random() * 100)
      }));
      setRealtimeData(newData);
    }
  };

  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: customOptions.responsive,
      maintainAspectRatio: customOptions.maintainAspectRatio,
      animation: customOptions.animation ? {
        duration: 1000,
        easing: 'easeInOutQuart'
      } : false,
      plugins: {
        legend: {
          display: customOptions.showLegend,
          position: 'top' as const
        },
        title: {
          display: true,
          text: currentConfig.title,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: currentConfig.type !== 'pie' && currentConfig.type !== 'doughnut' ? {
        x: {
          display: true,
          grid: {
            display: customOptions.showGrid
          }
        },
        y: {
          display: true,
          grid: {
            display: customOptions.showGrid
          }
        }
      } : {},
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      },
      onClick: (event: any, elements: any) => {
        if (onInteraction && elements.length > 0) {
          onInteraction({ event, elements, chartData: realtimeData });
        }
      }
    };

    return { ...baseOptions, ...currentConfig.options };
  }, [currentConfig, customOptions, realtimeData, onInteraction]);

  const processedData = useMemo(() => {
    const colors = colorSchemes[customOptions.colorScheme as keyof typeof colorSchemes] || colorSchemes.default;
    
    return {
      ...realtimeData,
      datasets: realtimeData.datasets?.map((dataset: any, index: number) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || colors[index % colors.length],
        borderColor: dataset.borderColor || colors[index % colors.length],
        borderWidth: dataset.borderWidth || 2
      }))
    };
  }, [realtimeData, customOptions.colorScheme]);

  const renderChart = () => {
    switch (currentConfig.type) {
      case 'line':
        return <Line ref={chartRef} data={processedData} options={chartOptions} />;
      case 'bar':
        return <Bar ref={chartRef} data={processedData} options={chartOptions} />;
      case 'pie':
        return <Pie ref={chartRef} data={processedData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut ref={chartRef} data={processedData} options={chartOptions} />;
      case 'scatter':
        return <Scatter ref={chartRef} data={processedData} options={chartOptions} />;
      case 'radar':
        return <Radar ref={chartRef} data={processedData} options={chartOptions} />;
      case 'heatmap':
        return renderHeatmap(currentConfig.data as HeatmapData);
      case 'treemap':
        return renderTreemap(currentConfig.data as TreemapData);
      default:
        return <Line ref={chartRef} data={processedData} options={chartOptions} />;
    }
  };

  const renderHeatmap = (data: HeatmapData) => {
    useEffect(() => {
      if (!d3ContainerRef.current || !data) return;

      const svg = d3.select(d3ContainerRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 30, right: 30, bottom: 40, left: 40 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      const g = svg
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleBand()
        .domain(data.xLabels)
        .range([0, chartWidth])
        .padding(0.1);

      const yScale = d3.scaleBand()
        .domain(data.yLabels)
        .range([chartHeight, 0])
        .padding(0.1);

      const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateViridis)
        .domain([0, d3.max(data.data.flat()) || 1]);

      // Draw heatmap cells
      data.data.forEach((row, i) => {
        row.forEach((value, j) => {
          g.append('rect')
            .attr('x', xScale(data.xLabels[j]) ?? 0)
            .attr('y', yScale(data.yLabels[i]) ?? 0)
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', colorScale(value))
            .on('mouseover', function(event) {
              d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
              // Add tooltip
            })
            .on('mouseout', function() {
              d3.select(this).attr('stroke', 'none');
            });
        });
      });

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale));

      g.append('g')
        .call(d3.axisLeft(yScale));

    }, [data, width, height]);

    return <svg ref={d3ContainerRef}></svg>;
  };

  const renderTreemap = (data: TreemapData) => {
    useEffect(() => {
      if (!d3ContainerRef.current || !data) return;

      const svg = d3.select(d3ContainerRef.current);
      svg.selectAll('*').remove();

      const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const treemap = d3.treemap()
        .size([width, height])
        .padding(2)
        .round(true);

      treemap(root as any);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      const cell = svg.selectAll('g')
        .data(root.leaves())
        .enter().append('g')
        .attr('transform', d => `translate(${(d as any).x0},${(d as any).y0})`);

      cell.append('rect')
        .attr('width', d => (d as any).x1 - (d as any).x0)
        .attr('height', d => (d as any).y1 - (d as any).y0)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      cell.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .text(d => d.data.name)
        .attr('font-size', '12px')
        .attr('fill', '#000');

    }, [data, width, height]);

    return <svg ref={d3ContainerRef}></svg>;
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const canvas = chartRef.current.canvas;
      const link = document.createElement('a');
      link.download = `${currentConfig.title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } else if (d3ContainerRef.current) {
      // Download SVG for D3 charts
      const svgData = new XMLSerializer().serializeToString(d3ContainerRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.download = `${currentConfig.title.replace(/\s+/g, '_')}.svg`;
      link.href = svgUrl;
      link.click();
    }
  };

  return (
    <Card sx={{ width: isFullscreen ? '100vw' : width, height: isFullscreen ? '100vh' : height + 100 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{currentConfig.title}</Typography>
          <Box>
            <Tooltip title="Refresh">
              <IconButton onClick={updateRealtimeData}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton onClick={downloadChart}>
                <Download />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsOpen(true)}>
                <Settings />
              </IconButton>
            </Tooltip>
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          {renderChart()}
        </Box>

        {currentConfig.realtime && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="success.main">
              ● Live Data (Updates every {currentConfig.updateInterval}ms)
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chart Settings</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={currentConfig.type}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <MenuItem value="line"><ShowChart sx={{ mr: 1 }} />Line Chart</MenuItem>
                  <MenuItem value="bar"><BarChart sx={{ mr: 1 }} />Bar Chart</MenuItem>
                  <MenuItem value="pie"><PieChart sx={{ mr: 1 }} />Pie Chart</MenuItem>
                  <MenuItem value="doughnut"><PieChart sx={{ mr: 1 }} />Doughnut Chart</MenuItem>
                  <MenuItem value="scatter"><TrendingUp sx={{ mr: 1 }} />Scatter Plot</MenuItem>
                  <MenuItem value="radar"><TrendingUp sx={{ mr: 1 }} />Radar Chart</MenuItem>
                  <MenuItem value="heatmap"><BarChart sx={{ mr: 1 }} />Heatmap</MenuItem>
                  <MenuItem value="treemap"><BarChart sx={{ mr: 1 }} />Treemap</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Color Scheme</InputLabel>
                <Select
                  value={customOptions.colorScheme}
                  onChange={(e) => setCustomOptions(prev => ({ ...prev, colorScheme: e.target.value }))}
                >
                  <MenuItem value="default">Default</MenuItem>
                  <MenuItem value="pastel">Pastel</MenuItem>
                  <MenuItem value="vibrant">Vibrant</MenuItem>
                  <MenuItem value="cool">Cool</MenuItem>
                  <MenuItem value="warm">Warm</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={customOptions.animation}
                    onChange={(e) => setCustomOptions(prev => ({ ...prev, animation: e.target.checked }))}
                  />
                }
                label="Animation"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={customOptions.showGrid}
                    onChange={(e) => setCustomOptions(prev => ({ ...prev, showGrid: e.target.checked }))}
                  />
                }
                label="Show Grid"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={customOptions.showLegend}
                    onChange={(e) => setCustomOptions(prev => ({ ...prev, showLegend: e.target.checked }))}
                  />
                }
                label="Show Legend"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentConfig.realtime}
                    onChange={(e) => setCurrentConfig(prev => ({ ...prev, realtime: e.target.checked }))}
                  />
                }
                label="Real-time Updates"
              />
            </Grid>
            
            {currentConfig.realtime && (
              <Grid item xs={12}>
                <Typography gutterBottom>Update Interval (ms)</Typography>
                <Slider
                  value={currentConfig.updateInterval || 1000}
                  onChange={(_, value) => setCurrentConfig(prev => ({ 
                    ...prev, 
                    updateInterval: value as number 
                  }))}
                  min={500}
                  max={10000}
                  step={500}
                  marks
                  valueLabelDisplay="auto"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdvancedChartSystem;