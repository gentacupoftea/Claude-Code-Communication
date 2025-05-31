import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';

interface ConfigManagerOptions {
  projectId: string;
  environment: string;
  configBucket?: string;
  secretPrefix?: string;
  cacheTTL?: number;
  autoReload?: boolean;
  reloadInterval?: number;
}

interface ConfigSource {
  type: 'file' | 'secret' | 'storage' | 'env';
  path: string;
  optional?: boolean;
  transform?: (data: any) => any;
}

interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validate?: (value: any) => boolean;
    sensitive?: boolean;
  };
}

export class ConfigManager extends EventEmitter {
  private secretManager: SecretManagerServiceClient;
  private storage: Storage;
  private options: ConfigManagerOptions;
  private config: Map<string, any> = new Map();
  private secrets: Map<string, any> = new Map();
  private configSources: Map<string, ConfigSource> = new Map();
  private schemas: Map<string, ConfigSchema> = new Map();
  private cache: Map<string, { value: any; expires: number }> = new Map();
  private reloadTimer?: NodeJS.Timer;

  constructor(options: ConfigManagerOptions) {
    super();
    this.options = options;
    this.secretManager = new SecretManagerServiceClient();
    this.storage = new Storage({ projectId: options.projectId });
    
    this.initializeDefaultSources();
    
    if (options.autoReload) {
      this.startAutoReload();
    }
  }

  private initializeDefaultSources(): void {
    // Default configuration sources
    this.addSource('base', {
      type: 'file',
      path: path.join(__dirname, '../../../config/base.yaml')
    });

    this.addSource('environment', {
      type: 'file',
      path: path.join(__dirname, `../../../config/${this.options.environment}.yaml`),
      optional: true
    });

    this.addSource('secrets', {
      type: 'secret',
      path: `${this.options.secretPrefix || 'shopify-mcp'}-${this.options.environment}`,
      optional: true
    });

    this.addSource('env', {
      type: 'env',
      path: '',
      transform: this.transformEnvVars
    });
  }

  // Add configuration source
  addSource(name: string, source: ConfigSource): void {
    this.configSources.set(name, source);
    logger.info(`Added config source: ${name}`, { type: source.type, path: source.path });
  }

  // Add configuration schema
  addSchema(name: string, schema: ConfigSchema): void {
    this.schemas.set(name, schema);
  }

  // Load all configuration
  async load(): Promise<void> {
    logger.info('Loading configuration', { environment: this.options.environment });

    for (const [name, source] of this.configSources) {
      try {
        const data = await this.loadSource(source);
        if (data) {
          this.mergeConfig(name, data);
        }
      } catch (error) {
        if (!source.optional) {
          logger.error(`Failed to load required config source: ${name}`, { error });
          throw error;
        }
        logger.warn(`Failed to load optional config source: ${name}`, { error });
      }
    }

    // Validate configuration against schemas
    await this.validateConfig();

    // Mask sensitive values in logs
    this.logConfiguration();

    this.emit('loaded', this.config);
  }

  private async loadSource(source: ConfigSource): Promise<any> {
    switch (source.type) {
      case 'file':
        return await this.loadFile(source.path);
      case 'secret':
        return await this.loadSecret(source.path);
      case 'storage':
        return await this.loadFromStorage(source.path);
      case 'env':
        return this.loadEnvVars();
      default:
        throw new Error(`Unknown config source type: ${source.type}`);
    }
  }

  private async loadFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          return yaml.load(content);
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async loadSecret(secretName: string): Promise<any> {
    try {
      const name = `projects/${this.options.projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await this.secretManager.accessSecretVersion({ name });
      
      const payload = version.payload?.data;
      if (!payload) {
        return null;
      }

      const secretString = payload.toString();
      return JSON.parse(secretString);
    } catch (error: any) {
      if (error.code === 5) { // NOT_FOUND
        return null;
      }
      throw error;
    }
  }

  private async loadFromStorage(path: string): Promise<any> {
    try {
      const bucket = this.storage.bucket(this.options.configBucket || `${this.options.projectId}-config`);
      const file = bucket.file(path);
      
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      throw error;
    }
  }

  private loadEnvVars(): any {
    const config: any = {};
    
    // Load environment variables with prefix
    const prefix = 'SHOPIFY_MCP_';
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.substring(prefix.length).toLowerCase().replace(/_/g, '.');
        this.setNestedValue(config, configKey, value);
      }
    }

    return config;
  }

  private transformEnvVars(data: any): any {
    // Transform environment variables to match config structure
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Convert string values to appropriate types
      let typedValue: any = value;
      
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') typedValue = true;
        else if (value.toLowerCase() === 'false') typedValue = false;
        else if (/^\d+$/.test(value)) typedValue = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) typedValue = parseFloat(value);
      }
      
      transformed[key] = typedValue;
    }

    return transformed;
  }

  private mergeConfig(sourceName: string, data: any): void {
    // Apply transformation if defined
    const source = this.configSources.get(sourceName);
    if (source?.transform) {
      data = source.transform(data);
    }

    // Deep merge configuration
    const existing = this.config.get(sourceName) || {};
    const merged = this.deepMerge(existing, data);
    this.config.set(sourceName, merged);
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  // Get configuration value
  get<T = any>(path: string, defaultValue?: T): T {
    // Check cache first
    const cached = this.cache.get(path);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Get value from merged config
    const parts = path.split('.');
    let value: any = this.getMergedConfig();
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) {
        return defaultValue as T;
      }
    }

    // Cache the value
    if (this.options.cacheTTL) {
      this.cache.set(path, {
        value,
        expires: Date.now() + this.options.cacheTTL
      });
    }

    return value;
  }

  // Get all configuration
  getAll(): any {
    return this.getMergedConfig();
  }

  // Get secret value
  async getSecret(name: string): Promise<string | null> {
    if (this.secrets.has(name)) {
      return this.secrets.get(name);
    }

    try {
      const secretName = `projects/${this.options.projectId}/secrets/${name}/versions/latest`;
      const [version] = await this.secretManager.accessSecretVersion({ name: secretName });
      
      const payload = version.payload?.data;
      if (!payload) {
        return null;
      }

      const secretValue = payload.toString();
      this.secrets.set(name, secretValue);
      return secretValue;
    } catch (error) {
      logger.error(`Failed to get secret: ${name}`, { error });
      return null;
    }
  }

  // Set configuration value (runtime only)
  set(path: string, value: any): void {
    const parts = path.split('.');
    let current = this.config.get('runtime') || {};
    let ref = current;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!ref[part]) {
        ref[part] = {};
      }
      ref = ref[part];
    }
    
    ref[parts[parts.length - 1]] = value;
    this.config.set('runtime', current);
    
    // Clear cache
    this.cache.delete(path);
    
    this.emit('changed', { path, value });
  }

  // Reload configuration
  async reload(): Promise<void> {
    logger.info('Reloading configuration');
    
    const oldConfig = this.getMergedConfig();
    await this.load();
    const newConfig = this.getMergedConfig();
    
    // Find changes
    const changes = this.findChanges(oldConfig, newConfig);
    
    if (changes.length > 0) {
      logger.info('Configuration changes detected', { changes });
      this.emit('changed', changes);
    }
  }

  private findChanges(oldConfig: any, newConfig: any, path: string = ''): any[] {
    const changes: any[] = [];
    
    // Check for new or changed values
    for (const key in newConfig) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in oldConfig)) {
        changes.push({ path: newPath, type: 'added', value: newConfig[key] });
      } else if (typeof newConfig[key] === 'object' && typeof oldConfig[key] === 'object') {
        changes.push(...this.findChanges(oldConfig[key], newConfig[key], newPath));
      } else if (newConfig[key] !== oldConfig[key]) {
        changes.push({ path: newPath, type: 'changed', oldValue: oldConfig[key], newValue: newConfig[key] });
      }
    }
    
    // Check for removed values
    for (const key in oldConfig) {
      if (!(key in newConfig)) {
        const removedPath = path ? `${path}.${key}` : key;
        changes.push({ path: removedPath, type: 'removed', oldValue: oldConfig[key] });
      }
    }
    
    return changes;
  }

  // Start auto-reload
  private startAutoReload(): void {
    if (this.reloadTimer) {
      return;
    }

    const interval = this.options.reloadInterval || 60000; // Default: 1 minute
    this.reloadTimer = setInterval(() => {
      this.reload().catch(error => {
        logger.error('Auto-reload failed', { error });
      });
    }, interval);

    logger.info('Started configuration auto-reload', { interval });
  }

  // Stop auto-reload
  stopAutoReload(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = undefined;
      logger.info('Stopped configuration auto-reload');
    }
  }

  // Validate configuration
  private async validateConfig(): Promise<void> {
    const config = this.getMergedConfig();
    
    for (const [schemaName, schema] of this.schemas) {
      for (const [key, definition] of Object.entries(schema)) {
        const value = this.get(key);
        
        // Check required fields
        if (definition.required && value === undefined) {
          throw new Error(`Required configuration missing: ${key}`);
        }
        
        // Skip validation if value is undefined and not required
        if (value === undefined) {
          continue;
        }
        
        // Type validation
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== definition.type) {
          throw new Error(`Configuration type mismatch for ${key}: expected ${definition.type}, got ${actualType}`);
        }
        
        // Custom validation
        if (definition.validate && !definition.validate(value)) {
          throw new Error(`Configuration validation failed for ${key}`);
        }
      }
    }
  }

  // Get merged configuration
  private getMergedConfig(): any {
    let merged = {};
    
    // Merge in order of precedence
    const precedence = ['base', 'environment', 'secrets', 'env', 'runtime'];
    
    for (const source of precedence) {
      const sourceConfig = this.config.get(source);
      if (sourceConfig) {
        merged = this.deepMerge(merged, sourceConfig);
      }
    }
    
    return merged;
  }

  // Log configuration (with sensitive values masked)
  private logConfiguration(): void {
    const config = this.getMergedConfig();
    const masked = this.maskSensitive(config);
    
    logger.info('Configuration loaded', { 
      environment: this.options.environment,
      config: masked 
    });
  }

  private maskSensitive(obj: any, path: string = ''): any {
    if (typeof obj !== 'object' || obj === null) {
      // Check if this path is marked as sensitive
      for (const [schemaName, schema] of this.schemas) {
        for (const [key, definition] of Object.entries(schema)) {
          if (key === path && definition.sensitive) {
            return '***MASKED***';
          }
        }
      }
      return obj;
    }

    const masked: any = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      masked[key] = this.maskSensitive(obj[key], newPath);
    }
    
    return masked;
  }

  // Export configuration
  async export(format: 'json' | 'yaml' = 'json'): Promise<string> {
    const config = this.getMergedConfig();
    const masked = this.maskSensitive(config);
    
    switch (format) {
      case 'json':
        return JSON.stringify(masked, null, 2);
      case 'yaml':
        return yaml.dump(masked);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test secret manager access
      await this.secretManager.listSecrets({
        parent: `projects/${this.options.projectId}`,
        pageSize: 1
      });

      // Test storage access
      if (this.options.configBucket) {
        const bucket = this.storage.bucket(this.options.configBucket);
        await bucket.exists();
      }

      return true;
    } catch (error) {
      logger.error('Config manager health check failed', { error });
      return false;
    }
  }

  // Cleanup
  async close(): Promise<void> {
    this.stopAutoReload();
    this.removeAllListeners();
  }
}