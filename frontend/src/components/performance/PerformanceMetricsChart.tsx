import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Bar
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import usePerformanceMetrics from '../../hooks/usePerformanceMetrics';
import { TimeSeriesMetric, MetricQuery } from '../../api/performanceService';

type ChartType = 'line' | 'area' | 'bar' | 'composed';

interface PerformanceMetricsChartProps {
  title: string;
  description?: string;
  metrics: string[];
  startDate?: Date;
  endDate?: Date;
  interval?: string;
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  chartType?: ChartType;
  height?: number;
  showLegend?: boolean;
  className?: string;
  colorPalette?: string[];
}

const PerformanceMetricsChart: React.FC<PerformanceMetricsChartProps> = ({
  title,
  description,
  metrics,
  startDate = subDays(new Date(), 7),
  endDate = new Date(),
  interval = '1h',
  aggregation = 'avg',
  chartType = 'line',
  height = 300,
  showLegend = true,
  className,
  colorPalette = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
}) => {
  const { fetchTimeSeriesMetrics } = usePerformanceMetrics();
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');

  // Predefined time ranges
  const timeRanges = useMemo(() => [
    { label: '24h', value: '24h', days: 1 },
    { label: '7d', value: '7d', days: 7 },
    { label: '30d', value: '30d', days: 30 },
    { label: '90d', value: '90d', days: 90 }
  ], []);

  // Handle time range change
  const handleTimeRangeChange = (range: string) => {
    const selectedRange = timeRanges.find(r => r.value === range);
    if (selectedRange) {
      setSelectedTimeRange(range);
    }
  };

  // Fetch metrics data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Determine date range based on selected time range
      const selectedRange = timeRanges.find(r => r.value === selectedTimeRange);
      const newStartDate = selectedRange ? subDays(new Date(), selectedRange.days) : startDate;
      
      // Update interval based on date range (longer range = longer interval)
      let newInterval = interval;
      if (selectedRange) {
        if (selectedRange.days > 30) {
          newInterval = '1d';
        } else if (selectedRange.days > 7) {
          newInterval = '6h';
        } else if (selectedRange.days > 1) {
          newInterval = '1h';
        } else {
          newInterval = '15m';
        }
      }

      const query: MetricQuery = {
        metrics,
        startDate: newStartDate.toISOString(),
        endDate: endDate.toISOString(),
        interval: newInterval,
        aggregation
      };

      const data = await fetchTimeSeriesMetrics(query);
      setTimeSeriesData(data);
    } catch (err) {
      setError('Failed to fetch metrics data');
      console.error('Error fetching metrics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on initial render and when selected time range changes
  useEffect(() => {
    fetchData();
  }, [selectedTimeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Format chart data for Recharts
  const chartData = useMemo(() => {
    if (!timeSeriesData.length) return [];

    // Find all unique timestamps across all metrics
    const allTimestamps = new Set<string>();
    timeSeriesData.forEach(metric => {
      metric.data.forEach(point => {
        allTimestamps.add(point.timestamp);
      });
    });

    // Sort timestamps chronologically
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Create chart data with all metrics for each timestamp
    return sortedTimestamps.map(timestamp => {
      const dataPoint: Record<string, any> = { timestamp };
      
      timeSeriesData.forEach(metric => {
        const point = metric.data.find(p => p.timestamp === timestamp);
        dataPoint[metric.name] = point ? point.value : null;
      });
      
      return dataPoint;
    });
  }, [timeSeriesData]);

  // Format X-axis tick values
  const formatXAxis = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      const selectedRange = timeRanges.find(r => r.value === selectedTimeRange);
      
      if (selectedRange && selectedRange.days > 7) {
        return format(date, 'MMM d');
      }
      
      return format(date, 'HH:mm');
    } catch (e) {
      return timestamp;
    }
  };

  // Format tooltip values
  const formatTooltip = (value: number, name: string) => {
    const metric = timeSeriesData.find(m => m.name === name);
    const unit = metric?.unit || '';
    
    return [value.toFixed(2), `${name} (${unit})`];
  };

  // Get units for Y-axis labels
  const getYAxisUnits = (): Record<string, string> => {
    const units: Record<string, string> = {};
    
    timeSeriesData.forEach(metric => {
      if (!units[metric.unit]) {
        units[metric.unit] = metric.unit;
      }
    });
    
    return units;
  };

  // Render appropriate chart type
  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                width={40}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(label), 'MMM d, yyyy HH:mm');
                  } catch (e) {
                    return label;
                  }
                }}
              />
              {showLegend && <Legend />}
              {timeSeriesData.map((metric, index) => (
                <Area 
                  key={metric.name}
                  type="monotone"
                  dataKey={metric.name}
                  stroke={colorPalette[index % colorPalette.length]}
                  fill={`${colorPalette[index % colorPalette.length]}33`} // 20% opacity
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  name={metric.name}
                  unit={metric.unit ? ` (${metric.unit})` : ''}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
        
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                width={40}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(label), 'MMM d, yyyy HH:mm');
                  } catch (e) {
                    return label;
                  }
                }}
              />
              {showLegend && <Legend />}
              {timeSeriesData.map((metric, index) => (
                <Bar 
                  key={metric.name}
                  dataKey={metric.name}
                  fill={colorPalette[index % colorPalette.length]}
                  isAnimationActive={false}
                  name={metric.name}
                  unit={metric.unit ? ` (${metric.unit})` : ''}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        );
        
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                width={40}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(label), 'MMM d, yyyy HH:mm');
                  } catch (e) {
                    return label;
                  }
                }}
              />
              {showLegend && <Legend />}
              {timeSeriesData.map((metric, index) => {
                // Use different chart types based on metric name or category
                if (metric.name.includes('count') || metric.name.includes('total')) {
                  return (
                    <Bar 
                      key={metric.name}
                      dataKey={metric.name}
                      fill={colorPalette[index % colorPalette.length]}
                      isAnimationActive={false}
                      name={metric.name}
                      unit={metric.unit ? ` (${metric.unit})` : ''}
                    />
                  );
                } else if (metric.name.includes('usage') || metric.name.includes('percentage')) {
                  return (
                    <Area 
                      key={metric.name}
                      type="monotone"
                      dataKey={metric.name}
                      stroke={colorPalette[index % colorPalette.length]}
                      fill={`${colorPalette[index % colorPalette.length]}33`} // 20% opacity
                      isAnimationActive={false}
                      name={metric.name}
                      unit={metric.unit ? ` (${metric.unit})` : ''}
                    />
                  );
                } else {
                  return (
                    <Line 
                      key={metric.name}
                      type="monotone"
                      dataKey={metric.name}
                      stroke={colorPalette[index % colorPalette.length]}
                      dot={false}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                      name={metric.name}
                      unit={metric.unit ? ` (${metric.unit})` : ''}
                    />
                  );
                }
              })}
            </ComposedChart>
          </ResponsiveContainer>
        );
        
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                width={40}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(label), 'MMM d, yyyy HH:mm');
                  } catch (e) {
                    return label;
                  }
                }}
              />
              {showLegend && <Legend />}
              {timeSeriesData.map((metric, index) => (
                <Line 
                  key={metric.name}
                  type="monotone"
                  dataKey={metric.name}
                  stroke={colorPalette[index % colorPalette.length]}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  name={metric.name}
                  unit={metric.unit ? ` (${metric.unit})` : ''}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            {timeRanges.map(range => (
              <button
                key={range.value}
                onClick={() => handleTimeRangeChange(range.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  selectedTimeRange === range.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
            <button
              onClick={fetchData}
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              title="Refresh data"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center text-red-500" style={{ height: `${height}px` }}>
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center text-gray-500" style={{ height: `${height}px` }}>
            No data available for the selected metrics and time range
          </div>
        ) : (
          renderChart()
        )}
      </div>
    </div>
  );
};

export default PerformanceMetricsChart;