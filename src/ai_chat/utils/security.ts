/**
 * AI Chat Security Utilities
 * 
 * Provides security-related functions for input validation,
 * sanitization, and content filtering.
 */

import { createHash } from 'crypto';

/**
 * Sanitizes user input to prevent injection attacks
 * @param input String to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove potential script tags and other dangerous HTML
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<img[^>]*>/gi, '[image]');
  
  // Limit input length to reasonable size
  const MAX_INPUT_LENGTH = 4000;
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '... (truncated)';
  }
  
  return sanitized;
}

/**
 * Sanitizes AI output before sending to client
 * @param output AI response to sanitize
 * @returns Sanitized output
 */
export function sanitizeOutput(output: string): string {
  if (!output) return '';
  
  // Allow specific HTML elements for markdown rendering
  // but remove potentially dangerous elements
  return output
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
    .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
    .replace(/javascript:/gi, 'removed:')
    .replace(/on\w+=/gi, 'data-removed=');
}

/**
 * Validates and sanitizes chart data JSON
 * @param jsonData Chart data as a JSON object
 * @returns Sanitized chart data or null if invalid
 */
export function validateChartData(jsonData: unknown): unknown | null {
  if (!jsonData || typeof jsonData !== 'object') {
    return null;
  }
  
  // Required properties
  if (!jsonData.type || !jsonData.data) {
    return null;
  }
  
  // Allowed chart types
  const validChartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'];
  if (!validChartTypes.includes(jsonData.type)) {
    return null;
  }
  
  // Clone the object for sanitization
  const sanitized = JSON.parse(JSON.stringify(jsonData));
  
  // Sanitize title and labels
  if (sanitized.title) {
    sanitized.title = sanitizeOutput(String(sanitized.title)).substring(0, 100);
  }
  
  if (sanitized.xAxisLabel) {
    sanitized.xAxisLabel = sanitizeOutput(String(sanitized.xAxisLabel)).substring(0, 50);
  }
  
  if (sanitized.yAxisLabel) {
    sanitized.yAxisLabel = sanitizeOutput(String(sanitized.yAxisLabel)).substring(0, 50);
  }
  
  // Sanitize data labels
  if (sanitized.data.labels && Array.isArray(sanitized.data.labels)) {
    sanitized.data.labels = sanitized.data.labels.map((label: unknown) => 
      typeof label === 'string' ? sanitizeOutput(label).substring(0, 50) : label
    );
  }
  
  // Limit dataset sizes
  if (sanitized.data.datasets && Array.isArray(sanitized.data.datasets)) {
    const MAX_DATASETS = 10;
    const MAX_DATA_POINTS = 100;
    
    sanitized.data.datasets = sanitized.data.datasets
      .slice(0, MAX_DATASETS)
      .map((dataset: unknown) => {
        if (dataset.label) {
          dataset.label = sanitizeOutput(String(dataset.label)).substring(0, 50);
        }
        
        if (dataset.data && Array.isArray(dataset.data)) {
          dataset.data = dataset.data.slice(0, MAX_DATA_POINTS);
        }
        
        return dataset;
      });
  }
  
  return sanitized;
}

/**
 * Generates a hash for caching chart images
 * @param chartData The chart data to hash
 * @returns A hash string for the chart data
 */
export function generateChartHash(chartData: unknown): string {
  const jsonString = JSON.stringify(chartData);
  return createHash('sha256').update(jsonString).digest('hex').substring(0, 16);
}