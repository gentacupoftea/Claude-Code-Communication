import React, { useMemo } from 'react';
import { Widget } from '../types';
import { LineChartWidget } from './Charts/LineChartWidget';
import { BarChartWidget } from './Charts/BarChartWidget';
import { PieChartWidget } from './Charts/PieChartWidget';
import { ScatterChartWidget } from './Charts/ScatterChartWidget';
import { HeatmapWidget } from './Charts/HeatmapWidget';
import { GaugeWidget } from './Charts/GaugeWidget';
import { KPICardWidget } from './Charts/KPICardWidget';
import { DataTableWidget } from './Charts/DataTableWidget';
import { MapWidget } from './Charts/MapWidget';
import { Box, Typography } from '@mui/material';

interface WidgetRendererProps {
  widget: Widget;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget }) => {
  const renderWidget = useMemo(() => {
    switch (widget.type) {
      case 'line-chart':
        return <LineChartWidget widget={widget} />;
      case 'bar-chart':
        return <BarChartWidget widget={widget} />;
      case 'pie-chart':
        return <PieChartWidget widget={widget} />;
      case 'scatter-chart':
        return <ScatterChartWidget widget={widget} />;
      case 'heatmap':
        return <HeatmapWidget widget={widget} />;
      case 'gauge':
        return <GaugeWidget widget={widget} />;
      case 'kpi-card':
        return <KPICardWidget widget={widget} />;
      case 'data-table':
        return <DataTableWidget widget={widget} />;
      case 'map':
        return <MapWidget widget={widget} />;
      default:
        return (
          <Box p={2}>
            <Typography>Unknown widget type: {widget.type}</Typography>
          </Box>
        );
    }
  }, [widget]);

  return <Box className="widget-container">{renderWidget}</Box>;
};