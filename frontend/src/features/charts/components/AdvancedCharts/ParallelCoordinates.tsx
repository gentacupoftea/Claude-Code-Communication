import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors, defaultDimensions } from './types';
import { exportChart } from './utils';

interface ParallelCoordinatesProps extends ChartProps {
  data: Record<string, any>[];
  dimensions: string[];
  colorBy?: string;
}

const ParallelCoordinates: React.FC<ParallelCoordinatesProps> = ({
  data,
  dimensions,
  colorBy,
  width = 900,
  height = 500,
  title = '平行座標プロット',
  onExport,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const margin = { ...defaultDimensions.margin, bottom: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || !data.length || !dimensions.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales for each dimension
    const y: { [key: string]: d3.ScaleLinear<number, number> | d3.ScalePoint<string> } = {};
    const x = d3.scalePoint()
      .domain(dimensions)
      .range([0, innerWidth]);

    // For each dimension, build a linear scale
    dimensions.forEach(dim => {
      const domain = d3.extent(data, d => +d[dim]);
      if (domain[0] !== undefined && domain[1] !== undefined) {
        y[dim] = d3.scaleLinear()
          .domain(domain)
          .range([innerHeight, 0]);
      } else {
        // Handle categorical data
        y[dim] = d3.scalePoint()
          .domain(data.map(d => d[dim]))
          .range([innerHeight, 0]);
      }
    });

    // Color scale
    let colorScale: d3.ScaleOrdinal<string, string> | d3.ScaleSequential<string>;
    if (colorBy && data[0][colorBy] !== undefined) {
      const colorDomain = Array.from(new Set(data.map(d => d[colorBy])));
      if (typeof data[0][colorBy] === 'number') {
        colorScale = d3.scaleSequential(d3.interpolateRgb(coneaColors.gradient[0], coneaColors.gradient[4]))
          .domain(d3.extent(data, d => d[colorBy]) as [number, number]);
      } else {
        colorScale = d3.scaleOrdinal(coneaColors.gradient)
          .domain(colorDomain);
      }
    } else {
      colorScale = () => coneaColors.primary;
    }

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'parallel-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('border', `1px solid ${coneaColors.primary}`)
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('font-size', '12px');

    // Draw the lines
    const line = d3.line<string>()
      .x(d => x(d) || 0)
      .y((d, i) => {
        const dim = dimensions[i];
        const scale = y[dim];
        const value = data[0][dim];
        return scale(value) || 0;
      });

    const path = (d: any) => {
      return d3.line()(dimensions.map(dim => {
        const xPos = x(dim) || 0;
        const yPos = y[dim](d[dim]) || 0;
        return [xPos, yPos];
      }) as any) || '';
    };

    // Add background lines
    g.append('g')
      .attr('class', 'background')
      .selectAll('path')
      .data(data)
      .enter().append('path')
      .attr('d', path)
      .style('fill', 'none')
      .style('stroke', '#ddd')
      .style('stroke-opacity', 0.4)
      .style('shape-rendering', 'crispEdges');

    // Add foreground lines
    const foreground = g.append('g')
      .attr('class', 'foreground')
      .selectAll('path')
      .data(data)
      .enter().append('path')
      .attr('d', path)
      .style('fill', 'none')
      .style('stroke', d => colorBy ? colorScale(d[colorBy]) : coneaColors.primary)
      .style('stroke-opacity', 0.7)
      .style('stroke-width', 1.5)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .style('stroke-opacity', 1)
          .style('stroke-width', 3);
        
        // Highlight this line
        foreground.style('stroke-opacity', 0.1);
        d3.select(this).style('stroke-opacity', 1);

        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        
        let content = '';
        dimensions.forEach(dim => {
          content += `${dim}: ${d[dim]}<br/>`;
        });
        
        tooltip.html(content)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        foreground.style('stroke-opacity', 0.7)
          .style('stroke-width', 1.5);
        
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add a group element for each dimension
    const dimension = g.selectAll('.dimension')
      .data(dimensions)
      .enter().append('g')
      .attr('class', 'dimension')
      .attr('transform', d => `translate(${x(d)},0)`);

    // Add an axis and title
    dimension.append('g')
      .attr('class', 'axis')
      .each(function(d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5));
      })
      .append('text')
      .style('text-anchor', 'middle')
      .attr('y', -9)
      .text(d => d)
      .style('fill', 'black')
      .style('font-size', '12px')
      .style('font-weight', 'bold');

    // Add dimension labels at the bottom
    dimension.append('text')
      .attr('class', 'dimension-label')
      .attr('text-anchor', 'middle')
      .attr('y', innerHeight + 20)
      .text(d => d)
      .style('fill', 'black')
      .style('font-size', '12px');

    // Add brush for each dimension
    dimension.append('g')
      .attr('class', 'brush')
      .each(function(d) {
        d3.select(this).call(
          d3.brushY()
            .extent([[-10, 0], [10, innerHeight]])
            .on('brush', brush)
            .on('end', brushEnd)
        );
      });

    // Brush functions
    const actives: { [key: string]: [number, number] } = {};

    function brush(event: any) {
      const selection = event.selection;
      const dim = event.target.__data__;
      
      if (selection) {
        actives[dim] = selection.map(y[dim].invert);
      } else {
        delete actives[dim];
      }
      
      updateDisplay();
    }

    function brushEnd(event: any) {
      if (!event.selection) {
        const dim = event.target.__data__;
        delete actives[dim];
        updateDisplay();
      }
    }

    function updateDisplay() {
      foreground.style('display', (d: any) => {
        return Object.keys(actives).every(dim => {
          const scale = y[dim];
          const extent = actives[dim];
          const value = d[dim];
          
          if (scale.invert) {
            return extent[1] <= value && value <= extent[0];
          }
          return true;
        }) ? null : 'none';
      });
    }

    // Add legend if colorBy is specified
    if (colorBy) {
      const legendData = Array.from(new Set(data.map(d => d[colorBy])));
      const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 100}, 20)`);

      legend.selectAll('rect')
        .data(legendData)
        .enter().append('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 20)
        .attr('width', 18)
        .attr('height', 18)
        .style('fill', d => colorScale(d));

      legend.selectAll('text')
        .data(legendData)
        .enter().append('text')
        .attr('x', 24)
        .attr('y', (d, i) => i * 20 + 9)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(d => String(d));
    }

    return () => {
      // Cleanup tooltip
      d3.select('body').selectAll('.parallel-tooltip').remove();
    };
  }, [data, dimensions, colorBy, width, height, innerWidth, innerHeight, margin]);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `parallel-coordinates.${format}`);
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

export default ParallelCoordinates;