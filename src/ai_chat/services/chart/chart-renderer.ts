/**
 * Chart Renderer
 * 
 * Renders charts based on provided chart data
 */

import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

export class ChartRenderer {
  private readonly width = 800;
  private readonly height = 600;
  private readonly backgroundColour = 'white';
  private readonly chartJSNodeCanvas: ChartJSNodeCanvas;
  
  constructor() {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: this.backgroundColour,
      plugins: {
        // Register required ChartJS plugins
        modern: true,
        requireLegacy: ['chartjs-plugin-datalabels']
      }
    });
  }
  
  /**
   * Renders a chart based on provided chart data
   * @param chartData Chart data object
   * @returns Promise resolving to a base64 encoded image
   */
  async renderChart(chartData: any): Promise<string> {
    try {
      // Convert chart data to ChartJS configuration
      const configuration = this.convertToChartJSConfig(chartData);
      
      // Render chart to buffer
      const image = await this.chartJSNodeCanvas.renderToBuffer(configuration);
      
      // Convert to base64 for embedding in response
      return `data:image/png;base64,${image.toString('base64')}`;
    } catch (error) {
      console.error('Chart rendering failed:', error);
      throw new Error(`Failed to render chart: ${error.message}`);
    }
  }
  
  /**
   * Converts chart data to ChartJS configuration
   * @param chartData Chart data to convert
   * @returns ChartJS configuration object
   */
  private convertToChartJSConfig(chartData: any): ChartConfiguration {
    // Extract chart properties
    const { type, data, options } = chartData;
    
    // Set sensible defaults for options
    const defaultOptions = {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        title: {
          display: !!chartData.title,
          text: chartData.title || '',
          font: {
            size: 16
          }
        },
        datalabels: {
          color: '#333',
          anchor: 'end',
          align: 'end',
          formatter: (value: number) => value
        }
      },
      scales: {
        x: {
          title: {
            display: !!chartData.xAxisLabel,
            text: chartData.xAxisLabel || ''
          }
        },
        y: {
          title: {
            display: !!chartData.yAxisLabel, 
            text: chartData.yAxisLabel || ''
          },
          beginAtZero: true
        }
      }
    };
    
    // Merge provided options with defaults
    const mergedOptions = {
      ...defaultOptions,
      ...(options || {})
    };
    
    // Create chart configuration
    return {
      type: type || 'bar',
      data,
      options: mergedOptions,
    };
  }
}