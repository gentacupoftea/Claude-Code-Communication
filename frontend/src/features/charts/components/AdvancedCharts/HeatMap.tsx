import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors, defaultDimensions } from './types';
import { exportChart } from './utils';

interface HeatMapData {
  x: string | number;
  y: string | number;
  value: number;
}

interface HeatMapProps extends ChartProps {
  data: HeatMapData[];
  xLabel?: string;
  yLabel?: string;
}

const HeatMap: React.FC<HeatMapProps> = ({
  data,
  width = defaultDimensions.width,
  height = defaultDimensions.height,
  title = 'ヒートマップ',
  xLabel = 'X軸',
  yLabel = 'Y軸',
  onExport,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const margin = defaultDimensions.margin;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Extract unique x and y values
    const xValues = Array.from(new Set(data.map(d => String(d.x)))).sort();
    const yValues = Array.from(new Set(data.map(d => String(d.y)))).sort();

    // Create scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, innerWidth])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([innerHeight, 0])
      .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateRgb('#f0fdf4', '#059669'))
      .domain([0, d3.max(data, d => d.value) || 1]);

    // Add X axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    // Add Y axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale));

    // Add X axis label
    g.append('text')
      .attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom)
      .text(xLabel);

    // Add Y axis label
    g.append('text')
      .attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -innerHeight / 2)
      .text(yLabel);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'heatmap-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('border', `1px solid ${coneaColors.primary}`)
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('font-size', '12px');

    // Add rectangles
    g.selectAll('.cell')
      .data(data)
      .enter().append('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(String(d.x)) || 0)
      .attr('y', d => yScale(String(d.y)) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', d => colorScale(d.value))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .on('mouseover', function(event, d) {
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`X: ${d.x}<br/>Y: ${d.y}<br/>値: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add color legend
    const legendWidth = 20;
    const legendHeight = innerHeight;
    const legendScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 1])
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5);

    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${innerWidth + 20}, 0)`);

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'heatmap-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.selectAll('stop')
      .data(coneaColors.heatmap)
      .enter().append('stop')
      .attr('offset', (d, i) => `${(i / (coneaColors.heatmap.length - 1)) * 100}%`)
      .attr('stop-color', d => d);

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#heatmap-gradient)');

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(legendAxis);

    return () => {
      // Cleanup tooltip
      d3.select('body').selectAll('.heatmap-tooltip').remove();
    };
  }, [data, width, height, innerWidth, innerHeight, margin, xLabel, yLabel]);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `heatmap.${format}`);
      onExport(format);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => handleExport('png')} title="PNG形式でダウンロード">
            <Download />
          </IconButton>
          <IconButton size="small" onClick={() => handleExport('svg')} title="SVG形式でダウンロード">
            <Download />
          </IconButton>
        </Stack>
      </Stack>

      <Box ref={chartRef}>
        <svg ref={svgRef} width={width} height={height} />
      </Box>
    </Paper>
  );
};

export default HeatMap;