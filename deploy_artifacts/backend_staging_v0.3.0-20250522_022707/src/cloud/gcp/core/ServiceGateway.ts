import { APIGateway } from '@google-cloud/api-gateway';
import { EndpointsServiceClient } from '@google-cloud/endpoints';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { Monitoring } from '@google-cloud/monitoring';
import { Auth } from 'google-auth-library';

interface ServiceEndpoint {
  name: string;
  url: string;
  healthCheck: string;
  timeout: number;
  retries: number;
  weight: number;
}

interface GatewayConfig {
  projectId: string;
  gatewayId: string;
  region: string;
  port: number;
  services: ServiceEndpoint[];
  rateLimits: {
    windowMs: number;
    max: number;
    message: string;
  };
  cors: {
    origins: string[];
    credentials: boolean;
  };
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextRetryTime: number;
}

export class ServiceGateway {
  private app: express.Application;
  private apiGateway: APIGateway;
  private endpointsClient: EndpointsServiceClient;
  private config: GatewayConfig;
  private serviceHealth: Map<string, boolean> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private monitoring: Monitoring;
  private auth: Auth;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.app = express();
    this.apiGateway = new APIGateway();
    this.endpointsClient = new EndpointsServiceClient();
    this.monitoring = new Monitoring({ projectId: config.projectId });
    this.auth = new Auth();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeCircuitBreakers();
    this.startHealthChecks();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.cors.origins,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID injection
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
      res.setHeader('x-request-id', req.headers['x-request-id']);
      next();
    });

    // Logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'];

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('API Gateway Request', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        });

        // Send metrics to Cloud Monitoring
        this.sendMetrics({
          requestId: requestId as string,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
        });
      });

      next();
    });

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: this.config.rateLimits.windowMs,
      max: this.config.rateLimits.max,
      message: this.config.rateLimits.message,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          headers: req.headers,
        });
        res.status(429).json({
          error: 'Too Many Requests',
          message: this.config.rateLimits.message,
          retryAfter: Math.ceil(this.config.rateLimits.windowMs / 1000),
        });
      },
    }));

    // Authentication middleware
    this.app.use(async (req: Request, res: Response, next: NextFunction) => {
      // Skip authentication for health checks and public endpoints
      if (req.path === '/health' || req.path === '/metrics' || req.path.startsWith('/public')) {
        return next();
      }

      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
        }

        // Verify JWT token
        const ticket = await this.auth.verifyIdToken(token);
        const payload = ticket.getPayload();
        
        if (!payload) {
          return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        }

        // Add user info to request
        (req as any).user = {
          id: payload.sub,
          email: payload.email,
          verified: payload.email_verified,
        };

        next();
      } catch (error) {
        logger.error('Authentication error', { error });
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
      }
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const healthStatus = this.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('Error fetching metrics', { error });
        res.status(500).json({ error: 'Failed to fetch metrics' });
      }
    });

    // Service discovery endpoint
    this.app.get('/services', (req: Request, res: Response) => {
      const services = this.config.services.map(service => ({
        name: service.name,
        health: this.serviceHealth.get(service.name) || false,
        circuitBreaker: this.circuitBreakers.get(service.name),
      }));
      res.json(services);
    });

    // Main routing logic
    this.app.all('/*', async (req: Request, res: Response) => {
      const path = req.path;
      const service = this.determineService(path);

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Check circuit breaker
      const circuitBreaker = this.circuitBreakers.get(service.name);
      if (circuitBreaker && circuitBreaker.state === 'OPEN') {
        if (Date.now() < circuitBreaker.nextRetryTime) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Circuit breaker is open',
            retryAfter: Math.ceil((circuitBreaker.nextRetryTime - Date.now()) / 1000),
          });
        } else {
          // Transition to half-open state
          circuitBreaker.state = 'HALF_OPEN';
        }
      }

      try {
        const response = await this.proxyRequest(req, service);
        
        // Reset circuit breaker on success
        if (circuitBreaker) {
          circuitBreaker.failures = 0;
          circuitBreaker.state = 'CLOSED';
        }

        // Forward response
        res.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        });
        res.send(response.data);
      } catch (error) {
        // Handle circuit breaker failure
        if (circuitBreaker) {
          circuitBreaker.failures++;
          circuitBreaker.lastFailureTime = Date.now();

          if (circuitBreaker.failures >= 5) {
            circuitBreaker.state = 'OPEN';
            circuitBreaker.nextRetryTime = Date.now() + 60000; // 1 minute
          }
        }

        logger.error('Service request failed', { error, service: service.name });
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Service request failed',
          service: service.name,
        });
      }
    });
  }

  private async proxyRequest(req: Request, service: ServiceEndpoint): Promise<any> {
    const axios = require('axios').default;
    const urlPath = req.path.replace(`/${service.name}`, '');
    const targetUrl = `${service.url}${urlPath}`;

    const config = {
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: undefined, // Remove host header
        'x-forwarded-for': req.ip,
        'x-forwarded-proto': req.protocol,
        'x-forwarded-host': req.headers.host,
      },
      data: req.body,
      timeout: service.timeout,
      maxRedirects: 5,
      validateStatus: () => true, // Accept any status code
    };

    // Retry logic
    let lastError: any;
    for (let attempt = 0; attempt <= service.retries; attempt++) {
      try {
        const response = await axios(config);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < service.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private determineService(path: string): ServiceEndpoint | undefined {
    // Extract service name from path (e.g., /shopify/products -> shopify)
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
      return undefined;
    }

    const serviceName = parts[0];
    return this.config.services.find(service => service.name === serviceName);
  }

  private initializeCircuitBreakers(): void {
    for (const service of this.config.services) {
      this.circuitBreakers.set(service.name, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        nextRetryTime: 0,
      });
    }
  }

  private startHealthChecks(): void {
    // Perform health checks every 30 seconds
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    // Initial health check
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const axios = require('axios').default;

    for (const service of this.config.services) {
      try {
        const response = await axios({
          method: 'GET',
          url: `${service.url}${service.healthCheck}`,
          timeout: 5000,
          validateStatus: (status: number) => status === 200,
        });

        this.serviceHealth.set(service.name, true);
        logger.debug(`Health check passed for ${service.name}`);
      } catch (error) {
        this.serviceHealth.set(service.name, false);
        logger.warn(`Health check failed for ${service.name}`, { error });
      }
    }
  }

  private getHealthStatus(): any {
    const services: any = {};
    let overallHealth = true;

    for (const service of this.config.services) {
      const health = this.serviceHealth.get(service.name) || false;
      const circuitBreaker = this.circuitBreakers.get(service.name);
      
      services[service.name] = {
        healthy: health,
        circuitBreaker: circuitBreaker?.state || 'UNKNOWN',
      };

      if (!health || circuitBreaker?.state === 'OPEN') {
        overallHealth = false;
      }
    }

    return {
      status: overallHealth ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };
  }

  private async sendMetrics(data: any): Promise<void> {
    try {
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        value: {
          int64Value: data.duration,
        },
      };

      const timeSeries = {
        metric: {
          type: 'custom.googleapis.com/gateway/request_duration',
          labels: {
            method: data.method,
            path: data.path,
            status_code: String(data.statusCode),
          },
        },
        points: [dataPoint],
      };

      const request = {
        name: `projects/${this.config.projectId}`,
        timeSeries: [timeSeries],
      };

      await this.monitoring.createTimeSeries(request);
    } catch (error) {
      logger.error('Failed to send metrics', { error });
    }
  }

  private async getMetrics(): Promise<any> {
    // Implement metrics collection
    // This would integrate with Cloud Monitoring API
    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: 0,
        success: 0,
        error: 0,
      },
      latency: {
        p50: 0,
        p90: 0,
        p99: 0,
      },
      services: Array.from(this.serviceHealth.entries()).map(([name, health]) => ({
        name,
        health,
        circuitBreaker: this.circuitBreakers.get(name)?.state,
      })),
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        logger.info(`Service Gateway started on port ${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Implement graceful shutdown
    logger.info('Stopping Service Gateway');
  }
}