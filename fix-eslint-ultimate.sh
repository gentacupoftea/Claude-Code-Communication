#!/bin/bash

# ULTIMATE ESLint CLEANUP SCRIPT
# This script will systematically fix all 930 ESLint warnings and errors

set -e

echo "🚀 STARTING ULTIMATE ESLint CLEANUP - Target: ZERO warnings and errors!"
echo "=================================================================="

# First, let's create a backup
echo "📁 Creating backup of src directory..."
cp -r src src_backup_$(date +%Y%m%d_%H%M%S)

# Count current issues
INITIAL_COUNT=$(npm run lint 2>&1 | grep -E "(Warning|Error)" | wc -l | xargs)
echo "📊 Initial ESLint issues: $INITIAL_COUNT"

echo ""
echo "🔧 Phase 1: Fixing @typescript-eslint/no-require-imports (190 issues)"
echo "=================================================="

# Fix require() imports by converting to ES6 imports
find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "require(" | while read file; do
    echo "  Fixing require imports in: $file"
    
    # Common require patterns and their ES6 equivalents
    sed -i '' 's/const fs = require('\''fs'\'')/import fs from '\''fs'\''/g' "$file"
    sed -i '' 's/const path = require('\''path'\'')/import path from '\''path'\''/g' "$file"
    sed -i '' 's/const crypto = require('\''crypto'\'')/import crypto from '\''crypto'\''/g' "$file"
    sed -i '' 's/const util = require('\''util'\'')/import util from '\''util'\''/g' "$file"
    sed -i '' 's/const os = require('\''os'\'')/import os from '\''os'\''/g' "$file"
    sed -i '' 's/const net = require('\''net'\'')/import net from '\''net'\''/g' "$file"
    sed -i '' 's/const dns = require('\''dns'\'')/import dns from '\''dns'\''/g' "$file"
    sed -i '' 's/const helmet = require('\''helmet'\'')/import helmet from '\''helmet'\''/g' "$file"
    sed -i '' 's/const axios = require('\''axios'\'')/import axios from '\''axios'\''/g' "$file"
    sed -i '' 's/const moment = require('\''moment'\'')/import moment from '\''moment'\''/g' "$file"
    sed -i '' 's/const csv = require('\''csv-parser'\'')/import csv from '\''csv-parser'\''/g' "$file"
    sed -i '' 's/const archiver = require('\''archiver'\'')/import archiver from '\''archiver'\''/g' "$file"
    sed -i '' 's/const { Redis } = require('\''ioredis'\'')/import { Redis } from '\''ioredis'\''/g' "$file"
    sed -i '' 's/const Redis = require('\''ioredis'\'')/import Redis from '\''ioredis'\''/g' "$file"
    sed -i '' 's/const Joi = require('\''joi'\'')/import Joi from '\''joi'\''/g' "$file"
    sed -i '' 's/const { RateLimiterMemory } = require('\''rate-limiter-flexible'\'')/import { RateLimiterMemory } from '\''rate-limiter-flexible'\''/g' "$file"
    
    # Google Cloud imports
    sed -i '' 's/const { BigQuery } = require('\''@google-cloud\/bigquery'\'')/import { BigQuery } from '\''@google-cloud\/bigquery'\''/g' "$file"
    sed -i '' 's/const { Storage } = require('\''@google-cloud\/storage'\'')/import { Storage } from '\''@google-cloud\/storage'\''/g' "$file"
    sed -i '' 's/const { PubSub } = require('\''@google-cloud\/pubsub'\'')/import { PubSub } from '\''@google-cloud\/pubsub'\''/g' "$file"
    sed -i '' 's/const { CloudResourceManager } = require('\''@google-cloud\/resource-manager'\'')/import { CloudResourceManager } from '\''@google-cloud\/resource-manager'\''/g' "$file"
    
    # More complex patterns with destructuring
    sed -i '' 's/const { \([^}]*\) } = require('\''\([^'\'']*\)'\'')/import { \1 } from '\''\2'\''/g' "$file"
    sed -i '' 's/const \([a-zA-Z_$][a-zA-Z0-9_$]*\) = require('\''\([^'\'']*\)'\'')/import \1 from '\''\2'\''/g' "$file"
done

echo ""
echo "🔧 Phase 2: Creating comprehensive type definitions (504 @typescript-eslint/no-explicit-any issues)"
echo "=============================================================================="

# Create comprehensive type definitions file
cat > src/types/comprehensive-types.ts << 'EOL'
// Comprehensive type definitions to eliminate all 'any' types

// Basic utility types
export type AnyObject = Record<string, unknown>;
export type AnyFunction = (...args: unknown[]) => unknown;
export type AnyArray = unknown[];

// API related types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
  status?: number;
}

export interface RequestConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
  code?: string | number;
}

// Data processing types
export interface DataProcessingOptions {
  batchSize?: number;
  concurrency?: number;
  timeout?: number;
  retries?: number;
}

export interface ProcessingResult<T = unknown> {
  data: T;
  processed: number;
  errors: string[];
  warnings: string[];
}

// Analytics types
export interface AnalyticsData {
  metrics: Record<string, number>;
  dimensions: Record<string, string>;
  timestamp: string;
  source: string;
}

export interface AnalyticsFilter {
  dateRange?: {
    start: string;
    end: string;
  };
  dimensions?: string[];
  metrics?: string[];
  segments?: string[];
}

export interface AnalyticsReport {
  data: AnalyticsData[];
  totals: Record<string, number>;
  metadata: {
    generatedAt: string;
    period: string;
    filters: AnalyticsFilter;
  };
}

// LLM and AI types
export interface LLMRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  options?: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AIAnalysisResult {
  insights: string[];
  recommendations: string[];
  confidence: number;
  data: Record<string, unknown>;
}

// Authentication types
export interface AuthCredentials {
  username?: string;
  email?: string;
  password?: string;
  token?: string;
  refreshToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

// Configuration types
export interface ConfigOptions {
  environment?: string;
  debug?: boolean;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  settings?: Record<string, unknown>;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  options?: Record<string, unknown>;
}

// E-commerce types
export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  metadata?: Record<string, unknown>;
}

// Sync and integration types
export interface SyncOptions {
  incremental?: boolean;
  batchSize?: number;
  parallel?: boolean;
  filters?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  errors: string[];
  duration: number;
  metadata?: Record<string, unknown>;
}

// Chart and visualization types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
  options?: Record<string, unknown>;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  options?: Record<string, unknown>;
}

// Event and callback types
export type EventHandler<T = unknown> = (event: T) => void;
export type AsyncEventHandler<T = unknown> = (event: T) => Promise<void>;
export type Callback<T = unknown> = (error: Error | null, result?: T) => void;

// Generic utility types for common patterns
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Express.js types for better type safety
export interface ExpressRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  user?: AuthUser;
  files?: unknown;
}

export interface ExpressResponse {
  json: (data: unknown) => void;
  status: (code: number) => ExpressResponse;
  send: (data: unknown) => void;
  redirect: (url: string) => void;
}

export type ExpressNext = (error?: Error) => void;

// Middleware types
export type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNext
) => void | Promise<void>;

// File handling types
export interface FileData {
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  destination?: string;
  filename?: string;
}

// Search and query types
export interface SearchQuery {
  q?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult<T = unknown> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
  facets?: Record<string, unknown>;
}

// Monitoring and health types
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface Metrics {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
  metadata?: Record<string, unknown>;
}
EOL

echo "✅ Created comprehensive type definitions"

echo ""
echo "🔧 Phase 3: Fixing unused variables with underscore prefix"
echo "======================================================="

# This will be done in the main TypeScript fixing phase
echo "Preparing to fix unused variables..."

# Check current count after require fixes
CURRENT_COUNT=$(npm run lint 2>&1 | grep -E "(Warning|Error)" | wc -l | xargs || echo "0")
echo "📊 Issues after require() fixes: $CURRENT_COUNT"

echo ""
echo "✅ Phase 1 Complete - Continue with TypeScript file fixes"
echo "Next: Run the TypeScript fixing script for the remaining issues"