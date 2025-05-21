/**
 * Chart Command Detector
 * 
 * Detects and extracts chart commands from AI messages
 */

export interface ChartCommand {
  command: string;
  data: any;
}

export class ChartCommandDetector {
  /**
   * Regular expression to match chart commands in the format:
   * ```chart
   * {
   *   "type": "bar",
   *   "data": { ... }
   * }
   * ```
   */
  private readonly CHART_COMMAND_REGEX = /```chart\s*\n([\s\S]*?)```/g;
  
  /**
   * Detects chart commands in text
   * @param text The text to scan for chart commands
   * @returns Array of parsed chart commands and their data
   */
  detectChartCommands(text: string): ChartCommand[] {
    const matches = [...text.matchAll(this.CHART_COMMAND_REGEX)];
    
    return matches
      .map(match => {
        const chartData = match[1];
        try {
          return {
            command: match[0],
            data: JSON.parse(chartData)
          };
        } catch (e) {
          console.error('Failed to parse chart data:', e);
          return null;
        }
      })
      .filter((cmd): cmd is ChartCommand => cmd !== null);
  }
  
  /**
   * Validates chart data against expected schema
   * @param chartData Chart data to validate
   * @returns True if valid, false otherwise
   */
  validateChartData(chartData: any): boolean {
    // Basic validation to ensure we have necessary properties
    if (!chartData || typeof chartData !== 'object') {
      return false;
    }
    
    // Must have type and data properties
    if (!chartData.type || !chartData.data) {
      return false;
    }
    
    // Validate chart type
    const validChartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'];
    if (!validChartTypes.includes(chartData.type)) {
      return false;
    }
    
    // For most chart types, we need labels and datasets
    if (chartData.type !== 'scatter' && chartData.type !== 'bubble') {
      if (!chartData.data.labels || !Array.isArray(chartData.data.labels)) {
        return false;
      }
      
      if (!chartData.data.datasets || !Array.isArray(chartData.data.datasets)) {
        return false;
      }
    }
    
    return true;
  }
}