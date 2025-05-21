/**
 * AI Chat Module
 * 
 * Main entry point for the AI Chat functionality
 */

import { Express } from 'express';
import aiRoutes from './routes/ai-routes';

/**
 * Initialize the AI Chat module
 * @param app Express application
 * @param basePath Base path for the API
 */
export function initializeAIChat(app: Express, basePath: string = '/api/ai') {
  // Register routes
  app.use(basePath, aiRoutes);
  
  console.log(`AI Chat module initialized with base path: ${basePath}`);
}

// Export components for use elsewhere
export * from './services/ai/adapter';
export * from './services/ai/provider-manager';
export * from './services/chart/chart-detector';
export * from './services/chart/chart-processor';
export * from './services/chart/chart-renderer';
export * from './services/context/context-manager';
export * from './services/context/transfer-manager';
export * from './services/summary/summarizer';
export * from './controllers/ai-chat-controller';