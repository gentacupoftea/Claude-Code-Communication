// Express サーバー実装

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MultiLLMOrchestrator } from './orchestrator/multi-llm';
import { LLMRouter } from './llm/router';
import { ContextBuilder } from './llm/context-builder';
import { ResponseEnhancer } from './llm/response-enhancer';
import { ResponseEvaluator } from './evaluation/quality-scorer';

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));

// Initialize MultiLLM system
const orchestrator = new MultiLLMOrchestrator({
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  gemini: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: process.env.GOOGLE_CLOUD_LOCATION
  },
  testMode: process.env.NODE_ENV !== 'production'
});

const router = new LLMRouter();
const contextBuilder = new ContextBuilder();
const responseEnhancer = new ResponseEnhancer();
const evaluator = new ResponseEvaluator();

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Main query endpoint
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { question, context, options } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Question is required',
        code: 'MISSING_QUESTION'
      });
    }

    const startTime = Date.now();

    // 1. Route to optimal LLM
    const routingDecision = router.route(question, context);
    
    // 2. Build enriched context
    const enrichedContext = contextBuilder.buildEnrichedContext(
      question,
      context,
      options?.category || 'general'
    );

    // 3. Query the LLM
    const rawResponse = await orchestrator.query(
      question,
      enrichedContext,
      routingDecision.provider
    );

    // 4. Enhance response
    const enhancedResponse = responseEnhancer.enhanceResponse(
      rawResponse,
      options?.category || 'general',
      {
        addMetrics: options?.includeMetrics ?? true,
        addImplementationSteps: options?.includeSteps ?? true,
        addVisualizationSuggestions: options?.includeVisualizations ?? false,
        formatAsReport: options?.formatAsReport ?? false
      }
    );

    // 5. Evaluate quality (optional)
    let qualityScore;
    if (options?.evaluateQuality) {
      qualityScore = evaluator.evaluate(question, enhancedResponse);
    }

    const responseTime = Date.now() - startTime;

    res.json({
      question,
      response: enhancedResponse,
      metadata: {
        provider: routingDecision.provider,
        confidence: routingDecision.confidence,
        responseTime,
        tokenCount: Math.ceil(enhancedResponse.length / 4),
        qualityScore: qualityScore?.overall,
        routing: {
          reasoning: routingDecision.reasoning,
          fallback: routingDecision.fallbackProvider
        }
      }
    });

  } catch (error) {
    console.error('Query error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      code: 'QUERY_FAILED',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'An error occurred processing your request'
    });
  }
});

// Batch query endpoint
app.post('/api/batch-query', async (req: Request, res: Response) => {
  try {
    const { queries } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: 'Queries array is required',
        code: 'MISSING_QUERIES'
      });
    }

    if (queries.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 queries per batch',
        code: 'BATCH_TOO_LARGE'
      });
    }

    const startTime = Date.now();

    // Route each query
    const routedQueries = queries.map((q, index) => ({
      id: q.id || index.toString(),
      question: q.question,
      context: q.context,
      provider: router.route(q.question, q.context).provider
    }));

    // Execute batch query
    const responses = await orchestrator.batchQuery(routedQueries);

    const results = Array.from(responses.entries()).map(([id, response]) => {
      const originalQuery = routedQueries.find(q => q.id === id);
      return {
        id,
        question: originalQuery?.question,
        response,
        provider: originalQuery?.provider
      };
    });

    const responseTime = Date.now() - startTime;

    res.json({
      results,
      metadata: {
        totalQueries: queries.length,
        responseTime,
        averageResponseTime: responseTime / queries.length
      }
    });

  } catch (error) {
    console.error('Batch query error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      code: 'BATCH_QUERY_FAILED',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'An error occurred processing your batch request'
    });
  }
});

// Provider status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    providers: {
      claude: { available: !!process.env.ANTHROPIC_API_KEY },
      openai: { available: !!process.env.OPENAI_API_KEY },
      gemini: { available: !!process.env.GOOGLE_CLOUD_PROJECT_ID }
    },
    features: {
      batch_processing: true,
      quality_evaluation: true,
      response_enhancement: true,
      intelligent_routing: true
    },
    limits: {
      max_tokens: parseInt(process.env.MAX_TOKENS || '2000'),
      rate_limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      batch_size: 50
    }
  });
});

// Metrics endpoint (if enabled)
if (process.env.ENABLE_METRICS === 'true') {
  app.get('/metrics', (req: Request, res: Response) => {
    // Prometheus metrics format
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP conea_requests_total Total number of requests
# TYPE conea_requests_total counter
conea_requests_total{endpoint="/api/query"} 0

# HELP conea_response_time_seconds Response time in seconds
# TYPE conea_response_time_seconds histogram
conea_response_time_seconds_bucket{le="1"} 0
conea_response_time_seconds_bucket{le="5"} 0
conea_response_time_seconds_bucket{le="10"} 0
conea_response_time_seconds_bucket{le="+Inf"} 0

# HELP conea_llm_requests_total Total LLM requests by provider
# TYPE conea_llm_requests_total counter
conea_llm_requests_total{provider="claude"} 0
conea_llm_requests_total{provider="openai"} 0
conea_llm_requests_total{provider="gemini"} 0
`);
  });
}

// Error handling middleware
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'UNHANDLED_ERROR',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const server = app.listen(port, () => {
  console.log(`🚀 Conea MultiLLM server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 API endpoint: http://localhost:${port}/api/query`);
  console.log(`📈 Status: http://localhost:${port}/api/status`);
});

export default server;