/**
 * Chart Command Detector
 * 
 * Detects and extracts chart commands from AI messages
 */

import { validateChartData } from '../../utils/security';

export interface ChartCommand {
  command: string;
  data: unknown;
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
          const parsedData = JSON.parse(chartData);
          
          // Apply security validation
          const sanitizedData = validateChartData(parsedData);
          if (sanitizedData === null) {
            console.warn('Chart data failed security validation');
            return null;
          }
          
          return {
            command: match[0],
            data: sanitizedData
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
  validateChartData(chartData: unknown): boolean {
    // First perform basic validation
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
    
    // Apply additional security validation
    // If the security validation fails, it will return null
    const sanitizedData = validateChartData(chartData);
    return sanitizedData !== null;
  }
}