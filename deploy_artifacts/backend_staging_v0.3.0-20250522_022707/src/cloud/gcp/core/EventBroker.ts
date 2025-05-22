import { PubSub, Message, Subscription, Topic } from '@google-cloud/pubsub';
import { CloudTasksClient } from '@google-cloud/tasks';
import { EventArcClient } from '@google-cloud/eventarc';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

interface EventBrokerConfig {
  projectId: string;
  region: string;
  defaultTimeout?: number;
  maxRetries?: number;
}

interface EventMessage {
  id: string;
  type: string;
  source: string;
  data: any;
  metadata?: Record<string, string>;
  timestamp: Date;
  version: string;
}

interface EventHandler {
  id: string;
  eventType: string | RegExp;
  handler: (event: EventMessage) => Promise<void>;
  options?: {
    maxRetries?: number;
    timeout?: number;
    filter?: (event: EventMessage) => boolean;
  };
}

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // Cron expression
  handler: () => Promise<void>;
  timezone?: string;
  enabled: boolean;
}

interface DLQConfig {
  topic: string;
  maxRetries: number;
  backoffMultiplier: number;
}

export class EventBroker {
  private pubsub: PubSub;
  private cloudTasks: CloudTasksClient;
  private eventArc: EventArcClient;
  private config: EventBrokerConfig;
  private topics: Map<string, Topic> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private handlers: Map<string, EventHandler[]> = new Map();
  private deadLetterQueues: Map<string, DLQConfig> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

  constructor(config: EventBrokerConfig) {
    this.config = config;
    this.pubsub = new PubSub({ projectId: config.projectId });
    this.cloudTasks = new CloudTasksClient();
    this.eventArc = new EventArcClient();
    
    this.setupDefaultTopics();
  }

  private async setupDefaultTopics(): Promise<void> {
    const defaultTopics = [
      'shopify-events',
      'analytics-events',
      'system-events',
      'error-events',
      'audit-events'
    ];

    for (const topicName of defaultTopics) {
      await this.createTopic(topicName);
      await this.createSubscription(topicName, `${topicName}-subscription`);
    }
  }

  // Topic Management
  async createTopic(topicName: string, options?: any): Promise<Topic> {
    if (this.topics.has(topicName)) {
      return this.topics.get(topicName)!;
    }

    try {
      const [topic] = await this.pubsub.createTopic(topicName, options);
      this.topics.set(topicName, topic);
      logger.info(`Created topic: ${topicName}`);
      return topic;
    } catch (error: any) {
      if (error.code === 6) { // Topic already exists
        const topic = this.pubsub.topic(topicName);
        this.topics.set(topicName, topic);
        return topic;
      }
      throw error;
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic ${topicName} not found`);
    }

    await topic.delete();
    this.topics.delete(topicName);
    logger.info(`Deleted topic: ${topicName}`);
  }

  // Subscription Management
  async createSubscription(
    topicName: string, 
    subscriptionName: string, 
    options?: any
  ): Promise<Subscription> {
    if (this.subscriptions.has(subscriptionName)) {
      return this.subscriptions.get(subscriptionName)!;
    }

    const topic = await this.createTopic(topicName);
    
    const defaultOptions = {
      deadLetterPolicy: {
        deadLetterTopic: `projects/${this.config.projectId}/topics/${topicName}-dlq`,
        maxDeliveryAttempts: this.config.maxRetries || 5
      },
      retryPolicy: {
        minimumBackoff: { seconds: 10 },
        maximumBackoff: { seconds: 600 }
      },
      ackDeadlineSeconds: 600
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const [subscription] = await topic.createSubscription(subscriptionName, finalOptions);
      this.subscriptions.set(subscriptionName, subscription);
      logger.info(`Created subscription: ${subscriptionName}`);
      return subscription;
    } catch (error: any) {
      if (error.code === 6) { // Subscription already exists
        const subscription = topic.subscription(subscriptionName);
        this.subscriptions.set(subscriptionName, subscription);
        return subscription;
      }
      throw error;
    }
  }

  // Event Publishing
  async publish(
    topicName: string, 
    eventType: string, 
    data: any, 
    metadata?: Record<string, string>
  ): Promise<string> {
    const topic = await this.createTopic(topicName);
    
    const event: EventMessage = {
      id: uuidv4(),
      type: eventType,
      source: 'shopify-mcp-server',
      data,
      metadata,
      timestamp: new Date(),
      version: '1.0'
    };

    const messageData = Buffer.from(JSON.stringify(event));
    const messageAttributes = {
      eventType,
      source: event.source,
      version: event.version,
      ...metadata
    };

    const messageId = await topic.publishMessage({
      data: messageData,
      attributes: messageAttributes
    });

    logger.info(`Published event: ${eventType}`, { messageId, topicName });
    return messageId;
  }

  // Batch Publishing
  async publishBatch(
    topicName: string,
    events: Array<{ type: string; data: any; metadata?: Record<string, string> }>
  ): Promise<string[]> {
    const topic = await this.createTopic(topicName);
    const messages = events.map(event => {
      const eventMessage: EventMessage = {
        id: uuidv4(),
        type: event.type,
        source: 'shopify-mcp-server',
        data: event.data,
        metadata: event.metadata,
        timestamp: new Date(),
        version: '1.0'
      };

      return {
        data: Buffer.from(JSON.stringify(eventMessage)),
        attributes: {
          eventType: event.type,
          source: eventMessage.source,
          version: eventMessage.version,
          ...event.metadata
        }
      };
    });

    const messageIds = await topic.publishBatch(messages);
    logger.info(`Published batch of ${events.length} events to ${topicName}`);
    return messageIds;
  }

  // Event Subscription
  async subscribe(
    subscriptionName: string,
    handler: EventHandler
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionName} not found`);
    }

    // Store handler
    if (!this.handlers.has(subscriptionName)) {
      this.handlers.set(subscriptionName, []);
    }
    this.handlers.get(subscriptionName)!.push(handler);

    // Start listening
    subscription.on('message', async (message: Message) => {
      try {
        const event = JSON.parse(message.data.toString()) as EventMessage;
        
        // Find matching handlers
        const matchingHandlers = this.handlers.get(subscriptionName)!.filter(h => {
          if (typeof h.eventType === 'string') {
            return h.eventType === event.type;
          } else {
            return h.eventType.test(event.type);
          }
        });

        // Execute handlers
        for (const handler of matchingHandlers) {
          if (handler.options?.filter && !handler.options.filter(event)) {
            continue;
          }

          await this.executeHandler(handler, event, message);
        }

        // Acknowledge message after successful processing
        message.ack();
      } catch (error) {
        logger.error('Error processing message', { error, messageId: message.id });
        
        // Nack the message to retry
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      logger.error('Subscription error', { error, subscriptionName });
    });

    logger.info(`Started subscription: ${subscriptionName}`);
  }

  private async executeHandler(
    handler: EventHandler,
    event: EventMessage,
    message: Message
  ): Promise<void> {
    const timeout = handler.options?.timeout || this.config.defaultTimeout || 30000;
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Handler timeout')), timeout);
      });

      await Promise.race([
        handler.handler(event),
        timeoutPromise
      ]);
    } catch (error) {
      logger.error('Handler execution error', { 
        error, 
        eventType: event.type,
        handlerId: handler.id 
      });
      
      // Check retry count
      const retryCount = parseInt(message.attributes?.retryCount || '0');
      const maxRetries = handler.options?.maxRetries || this.config.maxRetries || 3;
      
      if (retryCount < maxRetries) {
        // Increment retry count and republish
        message.attributes = {
          ...message.attributes,
          retryCount: String(retryCount + 1)
        };
        throw error; // Let PubSub handle retry
      } else {
        // Send to DLQ if configured
        await this.sendToDeadLetterQueue(event, error as Error);
      }
    }
  }

  // Dead Letter Queue Management
  async setupDeadLetterQueue(
    topicName: string,
    config: DLQConfig
  ): Promise<void> {
    await this.createTopic(config.topic);
    this.deadLetterQueues.set(topicName, config);
    logger.info(`Setup DLQ for topic: ${topicName}`);
  }

  private async sendToDeadLetterQueue(
    event: EventMessage,
    error: Error
  ): Promise<void> {
    const dlqTopic = 'error-events';
    
    await this.publish(dlqTopic, 'event.processing.failed', {
      originalEvent: event,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      timestamp: new Date()
    });
  }

  // Cloud Tasks Integration
  async createTask(
    queueName: string,
    payload: any,
    scheduleTime?: Date,
    options?: any
  ): Promise<string> {
    const parent = `projects/${this.config.projectId}/locations/${this.config.region}/queues/${queueName}`;
    
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: options?.url || `https://shopify-mcp.com/api/tasks/${queueName}`,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64')
      },
      scheduleTime: scheduleTime ? {
        seconds: Math.floor(scheduleTime.getTime() / 1000)
      } : undefined
    };

    const [response] = await this.cloudTasks.createTask({
      parent,
      task
    });

    logger.info(`Created task in queue: ${queueName}`, { taskId: response.name });
    return response.name!;
  }

  // Scheduled Tasks
  async registerScheduledTask(task: ScheduledTask): Promise<void> {
    this.scheduledTasks.set(task.id, task);
    
    if (task.enabled) {
      await this.scheduleTask(task);
    }
    
    logger.info(`Registered scheduled task: ${task.name}`);
  }

  private async scheduleTask(task: ScheduledTask): Promise<void> {
    const jobName = `${task.name}-${task.id}`;
    const parent = `projects/${this.config.projectId}/locations/${this.config.region}`;
    
    const job = {
      name: `${parent}/jobs/${jobName}`,
      schedule: task.schedule,
      timeZone: task.timezone || 'Asia/Tokyo',
      pubsubTarget: {
        topicName: `projects/${this.config.projectId}/topics/scheduled-tasks`,
        data: Buffer.from(JSON.stringify({
          taskId: task.id,
          taskName: task.name,
          timestamp: new Date()
        })).toString('base64')
      }
    };

    try {
      // This would use Cloud Scheduler API
      logger.info(`Scheduled task: ${task.name}`);
    } catch (error) {
      logger.error(`Failed to schedule task: ${task.name}`, { error });
      throw error;
    }
  }

  // Event Arc Integration
  async createEventArcTrigger(
    triggerName: string,
    eventFilter: any,
    destination: string
  ): Promise<void> {
    const parent = `projects/${this.config.projectId}/locations/${this.config.region}`;
    
    const trigger = {
      name: `${parent}/triggers/${triggerName}`,
      eventFilters: [eventFilter],
      destination: {
        cloudRunService: {
          service: destination,
          region: this.config.region
        }
      }
    };

    try {
      await this.eventArc.createTrigger({
        parent,
        trigger,
        triggerId: triggerName
      });
      
      logger.info(`Created EventArc trigger: ${triggerName}`);
    } catch (error) {
      logger.error(`Failed to create EventArc trigger: ${triggerName}`, { error });
      throw error;
    }
  }

  // Event Streaming
  createEventStream(
    subscriptionName: string,
    options?: {
      batchSize?: number;
      flushInterval?: number;
    }
  ): AsyncIterableIterator<EventMessage[]> {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionName} not found`);
    }

    const batchSize = options?.batchSize || 10;
    const flushInterval = options?.flushInterval || 1000;
    
    return {
      async *[Symbol.asyncIterator]() {
        let buffer: EventMessage[] = [];
        let timer: NodeJS.Timeout;

        const flush = () => {
          if (buffer.length > 0) {
            const batch = [...buffer];
            buffer = [];
            return batch;
          }
          return null;
        };

        const messageHandler = (message: Message) => {
          try {
            const event = JSON.parse(message.data.toString()) as EventMessage;
            buffer.push(event);
            message.ack();

            if (buffer.length >= batchSize) {
              clearTimeout(timer);
              const batch = flush();
              if (batch) {
                return batch;
              }
            }
          } catch (error) {
            logger.error('Failed to parse message', { error });
            message.nack();
          }
        };

        subscription.on('message', messageHandler);

        while (true) {
          timer = setTimeout(() => {
            const batch = flush();
            if (batch) {
              return batch;
            }
          }, flushInterval);

          const batch = await new Promise<EventMessage[] | null>((resolve) => {
            const handler = (message: Message) => {
              const result = messageHandler(message);
              if (result) {
                resolve(result);
              }
            };
            subscription.once('message', handler);
          });

          if (batch) {
            yield batch;
          }
        }
      }
    };
  }

  // Event Replay
  async replayEvents(
    subscriptionName: string,
    startTime: Date,
    endTime: Date,
    filter?: (event: EventMessage) => boolean
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionName} not found`);
    }

    // Seek to timestamp
    await subscription.seek(startTime);
    
    const handler = (message: Message) => {
      try {
        const event = JSON.parse(message.data.toString()) as EventMessage;
        
        if (event.timestamp > endTime) {
          subscription.removeListener('message', handler);
          return;
        }

        if (!filter || filter(event)) {
          // Process replayed event
          this.publish('replay-events', event.type, event.data, {
            ...event.metadata,
            replayed: 'true',
            originalTimestamp: event.timestamp.toISOString()
          });
        }

        message.ack();
      } catch (error) {
        logger.error('Error replaying event', { error });
        message.nack();
      }
    };

    subscription.on('message', handler);
  }

  // Metrics and Monitoring
  async getMetrics(): Promise<any> {
    const metrics = {
      topics: {},
      subscriptions: {},
      tasks: {}
    };

    // Get topic metrics
    for (const [name, topic] of this.topics) {
      const [metadata] = await topic.getMetadata();
      metrics.topics[name] = {
        messageRetentionDuration: metadata.messageRetentionDuration,
        schemaSettings: metadata.schemaSettings
      };
    }

    // Get subscription metrics
    for (const [name, subscription] of this.subscriptions) {
      const [metadata] = await subscription.getMetadata();
      metrics.subscriptions[name] = {
        ackDeadlineSeconds: metadata.ackDeadlineSeconds,
        messageRetentionDuration: metadata.messageRetentionDuration,
        deadLetterPolicy: metadata.deadLetterPolicy,
        retryPolicy: metadata.retryPolicy
      };
    }

    return metrics;
  }

  // Cleanup
  async close(): Promise<void> {
    // Close all subscriptions
    for (const subscription of this.subscriptions.values()) {
      await subscription.close();
    }

    logger.info('EventBroker closed');
  }
}