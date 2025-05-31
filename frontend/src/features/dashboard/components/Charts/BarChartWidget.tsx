import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Widget } from '../../types';
import { useDataSource } from '../../hooks/useDataSource';
import { Box, CircularProgress, Typography } from '@mui/material';

interface BarChartWidgetProps {
  widget: Widget;
}

export const BarChartWidget: React.FC<BarChartWidgetProps> = ({ widget }) => {
  const { data, loading, error } = useDataSource(widget.config.dataSource);
  const [option, setOption] = useState<any>({});

  useEffect(() => {
    if (data && data.length > 0) {
      const dimensions = widget.config.dimensions;
      const measures = widget.config.measures;

      // データ集計
      const categoryData = [...new Set(data.map((item: any) => item[dimensions[0]]))];
      const series = measures.map((measure) => ({
        name: measure.alias || measure.field,
        type: 'bar',
        data: categoryData.map((category) => {
          const items = data.filter((item: any) => item[dimensions[0]] === category);
          const sum = items.reduce((acc: number, item: any) => {
            return acc + (parseFloat(item[measure.field]) || 0);
          }, 0);
          return sum;
        }),
        animationDuration: 1500,
        animationEasing: 'elasticOut',
      }));

      const chartOption = {
        title: {
          text: widget.config.title,
          left: 'center',
          textStyle: {
            fontSize: 16,
            fontWeight: 'normal',
          },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
        },
        legend: {
          bottom: 0,
          data: measures.map((m) => m.alias || m.field),
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: categoryData,
          axisLabel: {
            interval: 0,
            rotate: 30,
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
              }
              return value.toString();
            },
          },
        },
        series,
        toolbox: {
          feature: {
            magicType: {
              type: ['line', 'bar', 'stack'],
            },
            restore: {},
            saveAsImage: {},
          },
        },
      };

      // カラーテーマ適用
      if (widget.config.styling?.colors) {
        chartOption.color = widget.config.styling.colors;
      }

      setOption(chartOption);
    }
  }, [data, widget.config]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Typography color="error">エラー: {error}</Typography>
      </Box>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
};