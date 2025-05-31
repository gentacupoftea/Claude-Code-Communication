import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors } from './types';
import { exportChart } from './utils';

interface ScatterPlotMatrixProps extends ChartProps {
  data: Record<string, number>[];
  columns: string[];
}

const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({
  data,
  columns,
  width = 800,
  height = 800,
  title = '散布図行列',
  onExport,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const margin = { top: 80, right: 80, bottom: 80, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || !data.length || !columns.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const n = columns.length;
    const cellSize = Math.floor(innerWidth / n);

    // Create scales for each column
    const scales: { [key: string]: d3.ScaleLinear<number, number> } = {};
    columns.forEach(col => {
      scales[col] = d3.scaleLinear()
        .domain(d3.extent(data, d => d[col]) as [number, number])
        .range([0, cellSize - 10]);
    });

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'scatterplot-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('border', `1px solid ${coneaColors.primary}`)
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('font-size', '12px');

    // Create a cell for each pair of columns
    const cell = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .selectAll('g')
      .data(d3.cross(d3.range(n), d3.range(n)))
      .enter().append('g')
      .attr('transform', ([i, j]) => `translate(${i * cellSize},${j * cellSize})`);

    // Add rectangles for cell backgrounds
    cell.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', cellSize - 5)
      .attr('height', cellSize - 5)
      .attr('fill', 'none')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 0.5);

    // Plot points for non-diagonal cells
    cell.each(function([i, j]) {
      const g = d3.select(this);
      const xCol = columns[i];
      const yCol = columns[j];

      if (i !== j) {
        // Scatter plot
        g.selectAll('circle')
          .data(data)
          .enter().append('circle')
          .attr('cx', d => scales[xCol](d[xCol]))
          .attr('cy', d => scales[yCol](d[yCol]))
          .attr('r', 2)
          .attr('fill', coneaColors.primary)
          .attr('fill-opacity', 0.7)
          .on('mouseover', function(event, d) {
            d3.select(this)
              .attr('r', 4)
              .attr('fill', coneaColors.secondary);
            tooltip.transition()
              .duration(200)
              .style('opacity', .9);
            tooltip.html(`${xCol}: ${d[xCol].toFixed(2)}<br/>${yCol}: ${d[yCol].toFixed(2)}`)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this)
              .attr('r', 2)
              .attr('fill', coneaColors.primary);
            tooltip.transition()
              .duration(500)
              .style('opacity', 0);
          });

        // Add axes
        if (j === n - 1) {
          // Bottom axis
          g.append('g')
            .attr('transform', `translate(0,${cellSize - 10})`)
            .call(d3.axisBottom(scales[xCol]).ticks(3).tickSize(3));
        }
        if (i === 0) {
          // Left axis
          g.append('g')
            .call(d3.axisLeft(scales[yCol]).ticks(3).tickSize(3));
        }
      } else {
        // Diagonal - show variable name and histogram
        g.append('text')
          .attr('x', cellSize / 2)
          .attr('y', cellSize / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .style('fill', coneaColors.primary)
          .text(xCol);

        // Add histogram
        const histogram = d3.histogram()
          .value(d => d[xCol])
          .domain(scales[xCol].domain() as [number, number])
          .thresholds(scales[xCol].ticks(10));

        const bins = histogram(data as any);
        const histogramScale = d3.scaleLinear()
          .domain([0, d3.max(bins, d => d.length) || 1])
          .range([0, cellSize / 3]);

        g.selectAll('.bar')
          .data(bins)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => scales[xCol](d.x0 || 0))
          .attr('y', d => cellSize / 2 + cellSize / 6 - histogramScale(d.length))
          .attr('width', d => scales[xCol](d.x1 || 0) - scales[xCol](d.x0 || 0) - 1)
          .attr('height', d => histogramScale(d.length))
          .attr('fill', coneaColors.primary)
          .attr('fill-opacity', 0.5);
      }
    });

    // Add column labels at the top
    svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top - 10})`)
      .selectAll('text')
      .data(columns)
      .enter().append('text')
      .attr('x', (d, i) => i * cellSize + cellSize / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d);

    // Add row labels on the right
    svg.append('g')
      .attr('transform', `translate(${margin.left + innerWidth + 10},${margin.top})`)
      .selectAll('text')
      .data(columns)
      .enter().append('text')
      .attr('x', 0)
      .attr('y', (d, i) => i * cellSize + cellSize / 2)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d);

    return () => {
      // Cleanup tooltip
      d3.select('body').selectAll('.scatterplot-tooltip').remove();
    };
  }, [data, columns, width, height, innerWidth, innerHeight, margin]);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `scatterplot-matrix.${format}`);
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

      <Box ref={chartRef} sx={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef} width={width} height={height} />
      </Box>
    </Paper>
  );
};

export default ScatterPlotMatrix;