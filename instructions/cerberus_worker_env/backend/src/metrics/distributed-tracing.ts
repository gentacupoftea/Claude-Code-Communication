import { Injectable } from '@nestjs/common';
import * as opentracing from 'opentracing';
import { JaegerTracer, initTracer } from 'jaeger-client';
import { FORMAT_HTTP_HEADERS } from 'opentracing';

interface TraceConfig {
  serviceName: string;
  sampler: {
    type: string;
    param: number;
  };
  reporter: {
    agentHost?: string;
    agentPort?: number;
    collectorEndpoint?: string;
    logSpans?: boolean;
  };
}

interface SpanContext {
  span: opentracing.Span;
  traceId: string;
  spanId: string;
}

/**
 * Distributed tracing service with Jaeger integration
 */
@Injectable()
export class DistributedTracing {
  private tracer: opentracing.Tracer;
  private activeSpans: Map<string, SpanContext> = new Map();
  
  constructor() {
    this.initializeTracer();
  }

  /**
   * Initialize Jaeger tracer
   */
  private initializeTracer() {
    const config: TraceConfig = {
      serviceName: process.env.SERVICE_NAME || 'conea-api',
      sampler: {
        type: 'probabilistic',
        param: parseFloat(process.env.TRACE_SAMPLING_RATE || '1.0')
      },
      reporter: {
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6832'),
        logSpans: process.env.NODE_ENV === 'development'
      }
    };

    this.tracer = initTracer(config as any, {
      logger: {
        info: (msg: string) => console.log('TRACE:', msg),
        error: (msg: string) => console.error('TRACE ERROR:', msg)
      }
    });

    // Set global tracer
    opentracing.globalTracer(this.tracer);
  }

  /**
   * Start a new trace span
   */
  startSpan(
    operationName: string,
    parentSpan?: opentracing.Span | null,
    tags?: Record<string, any>
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(operationName, spanOptions);
    
    // Add tags
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        span.setTag(key, value);
      });
    }

    // Add default tags
    span.setTag('service.name', process.env.SERVICE_NAME || 'conea-api');
    span.setTag('span.kind', 'server');
    
    const context = span.context() as any;
    const spanContext: SpanContext = {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };

    // Store active span
    this.activeSpans.set(operationName, spanContext);

    return spanContext;
  }

  /**
   * Start HTTP request span
   */
  startHttpSpan(
    method: string,
    path: string,
    headers: Record<string, string>,
    parentSpan?: opentracing.Span
  ): SpanContext {
    // Try to extract parent context from headers
    const parentContext = this.tracer.extract(FORMAT_HTTP_HEADERS, headers);
    
    const spanOptions: opentracing.SpanOptions = {};
    if (parentContext) {
      spanOptions.childOf = parentContext;
    } else if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`${method} ${path}`, spanOptions);
    
    // HTTP specific tags
    span.setTag('http.method', method);
    span.setTag('http.url', path);
    span.setTag('span.kind', 'server');
    span.setTag('component', 'http');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Start database query span
   */
  startDatabaseSpan(
    operation: string,
    query: string,
    parentSpan?: opentracing.Span
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`db.${operation}`, spanOptions);
    
    // Database specific tags
    span.setTag('db.type', 'postgresql');
    span.setTag('db.statement', this.sanitizeQuery(query));
    span.setTag('span.kind', 'client');
    span.setTag('component', 'database');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Start cache operation span
   */
  startCacheSpan(
    operation: 'get' | 'set' | 'delete',
    key: string,
    parentSpan?: opentracing.Span
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`cache.${operation}`, spanOptions);
    
    // Cache specific tags
    span.setTag('cache.type', 'redis');
    span.setTag('cache.key', key);
    span.setTag('cache.operation', operation);
    span.setTag('span.kind', 'client');
    span.setTag('component', 'cache');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Start external API call span
   */
  startExternalApiSpan(
    service: string,
    endpoint: string,
    method: string,
    parentSpan?: opentracing.Span
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`external.${service}`, spanOptions);
    
    // External API specific tags
    span.setTag('external.service', service);
    span.setTag('external.endpoint', endpoint);
    span.setTag('http.method', method);
    span.setTag('span.kind', 'client');
    span.setTag('component', 'http-client');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Add event to span
   */
  addEvent(span: opentracing.Span, eventName: string, attributes?: Record<string, any>) {
    span.log({
      event: eventName,
      ...attributes
    });
  }

  /**
   * Add error to span
   */
  addError(span: opentracing.Span, error: Error) {
    span.setTag('error', true);
    span.setTag('error.type', error.name);
    span.setTag('error.message', error.message);
    
    span.log({
      event: 'error',
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Finish span
   */
  finishSpan(spanContext: SpanContext, statusCode?: number) {
    if (statusCode) {
      spanContext.span.setTag('http.status_code', statusCode);
      
      if (statusCode >= 400) {
        spanContext.span.setTag('error', true);
      }
    }

    spanContext.span.finish();
    
    // Remove from active spans
    const activeSpan = Array.from(this.activeSpans.entries())
      .find(([_, ctx]) => ctx.spanId === spanContext.spanId);
    
    if (activeSpan) {
      this.activeSpans.delete(activeSpan[0]);
    }
  }

  /**
   * Inject trace context into headers
   */
  injectTraceContext(span: opentracing.Span, headers: Record<string, string>): Record<string, string> {
    const carrier = {};
    this.tracer.inject(span.context(), FORMAT_HTTP_HEADERS, carrier);
    
    return {
      ...headers,
      ...carrier
    };
  }

  /**
   * Create baggage items for cross-service context propagation
   */
  setBaggageItem(span: opentracing.Span, key: string, value: string) {
    span.setBaggageItem(key, value);
  }

  /**
   * Get baggage item
   */
  getBaggageItem(span: opentracing.Span, key: string): string | undefined {
    return span.getBaggageItem(key);
  }

  /**
   * Middleware helper for Express
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const spanContext = this.startHttpSpan(
        req.method,
        req.path,
        req.headers
      );

      // Attach span to request
      req.span = spanContext.span;
      req.traceId = spanContext.traceId;
      req.spanId = spanContext.spanId;

      // Add request details
      spanContext.span.setTag('http.remote_addr', req.ip);
      spanContext.span.setTag('user_agent', req.get('user-agent'));

      // Finish span on response
      const originalSend = res.send;
      res.send = function(...args: any[]) {
        spanContext.span.setTag('http.status_code', res.statusCode);
        
        if (res.statusCode >= 400) {
          spanContext.span.setTag('error', true);
        }

        spanContext.span.finish();
        return originalSend.apply(res, args);
      };

      next();
    };
  }

  /**
   * Sanitize database query for tracing
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/api_key\s*=\s*'[^']*'/gi, "api_key='***'");
  }

  /**
   * Get active traces summary
   */
  getActiveTraces(): Array<{
    operationName: string;
    traceId: string;
    spanId: string;
    startTime: number;
  }> {
    return Array.from(this.activeSpans.entries()).map(([operationName, context]) => ({
      operationName,
      traceId: context.traceId,
      spanId: context.spanId,
      startTime: (context.span as any)._startTime || Date.now()
    }));
  }

  /**
   * Create custom span for AI operations
   */
  startAIOperationSpan(
    operation: 'inference' | 'training' | 'anomaly_detection',
    model: string,
    parentSpan?: opentracing.Span
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`ai.${operation}`, spanOptions);
    
    // AI specific tags
    span.setTag('ai.operation', operation);
    span.setTag('ai.model', model);
    span.setTag('span.kind', 'internal');
    span.setTag('component', 'ai-engine');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Create span for authentication operations
   */
  startAuthSpan(
    operation: 'login' | 'logout' | 'token_refresh' | 'validate',
    method: string,
    parentSpan?: opentracing.Span
  ): SpanContext {
    const spanOptions: opentracing.SpanOptions = {};
    if (parentSpan) {
      spanOptions.childOf = parentSpan;
    }

    const span = this.tracer.startSpan(`auth.${operation}`, spanOptions);
    
    // Auth specific tags
    span.setTag('auth.operation', operation);
    span.setTag('auth.method', method);
    span.setTag('span.kind', 'internal');
    span.setTag('component', 'authentication');

    const context = span.context() as any;
    return {
      span,
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown'
    };
  }

  /**
   * Flush all pending spans
   */
  async flush(): Promise<void> {
    // Finish all active spans
    this.activeSpans.forEach((context) => {
      context.span.finish();
    });
    
    this.activeSpans.clear();
    
    // Close tracer
    if (this.tracer && typeof (this.tracer as any).close === 'function') {
      await (this.tracer as any).close();
    }
  }
}