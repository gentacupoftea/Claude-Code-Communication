/**
 * Chart Processor
 * 
 * Processes text to detect chart commands and replace them with rendered charts
 */

import { ChartCommandDetector } from './chart-detector';
import { ChartRenderer } from './chart-renderer';

export class ChartProcessor {
  private detector: ChartCommandDetector;
  private renderer: ChartRenderer;
  
  constructor() {
    this.detector = new ChartCommandDetector();
    this.renderer = new ChartRenderer();
  }
  
  /**
   * Process text to detect and render charts
   * @param text The text to process
   * @returns Promise resolving to the processed text with chart commands replaced with images
   */
  async processText(text: string): Promise<string> {
    // Detect chart commands
    const chartCommands = this.detector.detectChartCommands(text);
    
    if (chartCommands.length === 0) {
      return text; // No charts to process
    }
    
    let processedText = text;
    
    // Process each chart command
    for (const cmd of chartCommands) {
      try {
        // Validate the chart data
        if (!this.detector.validateChartData(cmd.data)) {
          throw new Error('Invalid chart data format');
        }
        
        // Render the chart
        const chartImage = await this.renderer.renderChart(cmd.data);
        
        // Replace the chart command with the image in markdown format
        processedText = processedText.replace(
          cmd.command,
          `![Chart](${chartImage})`
        );
      } catch (error) {
        console.error('Chart processing error:', error);
        // Replace with error message
        processedText = processedText.replace(
          cmd.command,
          `\`\`\`\nChart generation failed: ${error instanceof Error ? error.message : String(error)}\n\`\`\``
        );
      }
    }
    
    return processedText;
  }
  
  /**
   * Generates example chart code that can be used to help users
   * @param chartType The type of chart to generate an example for
   * @returns Example chart code as a string
   */
  generateExampleChartCode(chartType: string = 'bar'): string {
    const examples: Record<string, string> = {
      bar: `\`\`\`chart
{
  "type": "bar",
  "title": "Monthly Sales",
  "xAxisLabel": "Month",
  "yAxisLabel": "Revenue ($)",
  "data": {
    "labels": ["January", "February", "March", "April", "May"],
    "datasets": [{
      "label": "2024 Sales",
      "data": [12000, 19000, 15000, 25000, 22000],
      "backgroundColor": "rgba(54, 162, 235, 0.5)"
    }, {
      "label": "2023 Sales",
      "data": [10000, 15000, 12000, 22000, 18000],
      "backgroundColor": "rgba(255, 99, 132, 0.5)"
    }]
  }
}
\`\`\``,
      line: `\`\`\`chart
{
  "type": "line",
  "title": "Website Traffic",
  "xAxisLabel": "Day",
  "yAxisLabel": "Visitors",
  "data": {
    "labels": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "datasets": [{
      "label": "Visitors",
      "data": [1500, 1800, 2100, 1900, 2200, 2500, 2300],
      "borderColor": "rgba(75, 192, 192, 1)",
      "tension": 0.1,
      "fill": false
    }]
  }
}
\`\`\``,
      pie: `\`\`\`chart
{
  "type": "pie",
  "title": "Revenue by Product Category",
  "data": {
    "labels": ["Electronics", "Clothing", "Food", "Books", "Home Goods"],
    "datasets": [{
      "data": [35, 25, 20, 10, 10],
      "backgroundColor": [
        "rgba(255, 99, 132, 0.7)",
        "rgba(54, 162, 235, 0.7)",
        "rgba(255, 206, 86, 0.7)",
        "rgba(75, 192, 192, 0.7)",
        "rgba(153, 102, 255, 0.7)"
      ]
    }]
  }
}
\`\`\``
    };
    
    // Return the example for the requested chart type or bar if not found
    return examples[chartType] || examples.bar;
  }
}