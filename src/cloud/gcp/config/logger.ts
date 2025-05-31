import winston from 'winston';
import { Logging } from '@google-cloud/logging';

interface LoggerConfig {
  projectId?: string;
  service?: string;
  version?: string;
  level?: string;
}

class Logger {
  private winston: winston.Logger;
  private stackdriver?: any;
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      projectId: config.projectId || process.env.GCP_PROJECT_ID,
      service: config.service || process.env.SERVICE_NAME || 'shopify-mcp-server',
      version: config.version || process.env.SERVICE_VERSION || '1.0.0',
      level: config.level || process.env.LOG_LEVEL || 'info'
    };

    // Create Winston logger
    this.winston = winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: this.config.service,
        version: this.config.version
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Add Stackdriver logging if in GCP environment
    if (this.config.projectId) {
      this.initializeStackdriver();
    }
  }

  private initializeStackdriver(): void {
    try {
      const logging = new Logging({ projectId: this.config.projectId });
      const log = logging.log(this.config.service);
      
      const stream = log.stream({
        resource: {
          type: 'global',
          labels: {
            project_id: this.config.projectId
          }
        }
      });

      // Add Stackdriver transport
      this.winston.add(new winston.transports.Stream({ stream }));
      this.stackdriver = log;
    } catch (error) {
      console.error('Failed to initialize Stackdriver logging:', error);
    }
  }

  // Log methods
  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.winston.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  // Structured logging for specific events
  logApiRequest(req: any, res: any, duration: number): void {
    this.info('API Request', {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      correlationId: req.headers['x-correlation-id']
    });
  }

  logError(error: Error, context?: any): void {
    this.error(error.message, {
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  logMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.info('Metric', {
      metric: name,
      value,
      labels,
      timestamp: new Date().toISOString()
    });
  }

  logEvent(eventType: string, data: any): void {
    this.info('Event', {
      eventType,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Middleware for Express
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      // Add correlation ID if not present
      if (!req.headers['x-correlation-id']) {
        req.headers['x-correlation-id'] = this.generateCorrelationId();
      }

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logApiRequest(req, res, duration);
      });

      next();
    };
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Flush logs
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve);
      this.winston.end();
    });
  }
}

// Export singleton instance
export const logger = new Logger();