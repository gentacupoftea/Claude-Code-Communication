import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { Box, Typography, Paper, IconButton, Stack } from '@mui/material';
import { Download } from '@mui/icons-material';
import { ChartProps, coneaColors, defaultDimensions } from './types';
import { exportChart } from './utils';

interface SankeyNode {
  name: string;
  id?: string;
}

interface SankeyLink {
  source: string | number;
  target: string | number;
  value: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

interface SankeyDiagramProps extends ChartProps {
  data: SankeyData;
}

const SankeyDiagram: React.FC<SankeyDiagramProps> = ({
  data,
  width = 800,
  height = 600,
  title = 'サンキーダイアグラム',
  onExport,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const margin = defaultDimensions.margin;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length || !data.links.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create sankey generator
    const sankeyGenerator = sankey()
      .nodeId((d: any) => d.id || d.name)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Process data
    const processedData = {
      nodes: data.nodes.map((d, i) => ({ ...d, id: d.id || d.name })),
      links: data.links.map(d => ({ ...d }))
    };

    const { nodes, links } = sankeyGenerator(processedData as any);

    // Color scale
    const color = d3.scaleOrdinal(coneaColors.gradient);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'sankey-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('border', `1px solid ${coneaColors.primary}`)
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('font-size', '12px');

    // Add links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .enter().append('path')
      .attr('d', sankeyLinkHorizontal() as any)
      .attr('stroke', (d: any) => color(d.source.name))
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .attr('fill', 'none')
      .attr('opacity', 0.5)
      .on('mouseover', function(event, d: any) {
        d3.select(this).attr('opacity', 0.8);
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`${d.source.name} → ${d.target.name}<br/>値: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.5);
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g');

    node.append('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => color(d.name))
      .attr('stroke', '#000')
      .on('mouseover', function(event, d: any) {
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        const total = d3.sum(d.sourceLinks, (l: any) => l.value) + d3.sum(d.targetLinks, (l: any) => l.value);
        tooltip.html(`${d.name}<br/>合計: ${total}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add node labels
    node.append('text')
      .attr('x', (d: any) => d.x0 < innerWidth / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', (d: any) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => d.x0 < innerWidth / 2 ? 'start' : 'end')
      .text((d: any) => d.name)
      .style('font-size', '12px');

    return () => {
      // Cleanup tooltip
      d3.select('body').selectAll('.sankey-tooltip').remove();
    };
  }, [data, width, height, innerWidth, innerHeight, margin]);

  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current && onExport) {
      exportChart(chartRef.current, format, `sankey-diagram.${format}`);
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

export default SankeyDiagram;