import { Firestore, DocumentData, Query, CollectionReference, DocumentReference } from '@google-cloud/firestore';
import { BigQuery, Dataset, Table, Job } from '@google-cloud/bigquery';
import { Datastore, Key, Entity } from '@google-cloud/datastore';
import { Redis } from 'ioredis';
import { Storage, Bucket, File } from '@google-cloud/storage';
import { logger } from '../config/logger';

interface DataLayerConfig {
  projectId: string;
  region: string;
  firestore: {
    databaseId: string;
  };
  bigquery: {
    datasetId: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  storage: {
    bucketName: string;
  };
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  where?: { field: string; operator: string; value: any }[];
  select?: string[];
}

interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

interface StreamOptions {
  batchSize?: number;
  transform?: (item: any) => any;
}

export class DataLayerClient {
  private firestore: Firestore;
  private bigquery: BigQuery;
  private datastore: Datastore;
  private redis: Redis;
  private storage: Storage;
  private config: DataLayerConfig;
  private cacheNamespace = 'shopify-mcp';

  constructor(config: DataLayerConfig) {
    this.config = config;
    
    // Initialize clients
    this.firestore = new Firestore({
      projectId: config.projectId,
      databaseId: config.firestore.databaseId,
    });

    this.bigquery = new BigQuery({
      projectId: config.projectId,
      location: config.region,
    });

    this.datastore = new Datastore({
      projectId: config.projectId,
    });

    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: 0,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.storage = new Storage({
      projectId: config.projectId,
    });

    this.setupRedisEvents();
  }

  private setupRedisEvents(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error', { error });
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  // Firestore Operations
  async firestoreGet(collection: string, documentId: string): Promise<DocumentData | null> {
    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Firestore get error', { collection, documentId, error });
      throw error;
    }
  }

  async firestoreSet(collection: string, documentId: string, data: any): Promise<void> {
    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      await docRef.set(data, { merge: true });
      
      // Invalidate cache
      await this.cacheDelete(`${collection}:${documentId}`);
    } catch (error) {
      logger.error('Firestore set error', { collection, documentId, error });
      throw error;
    }
  }

  async firestoreQuery(collection: string, options: QueryOptions = {}): Promise<DocumentData[]> {
    try {
      let query: Query = this.firestore.collection(collection);

      // Apply where clauses
      if (options.where) {
        for (const condition of options.where) {
          query = query.where(condition.field, condition.operator as any, condition.value);
        }
      }

      // Apply ordering
      if (options.orderBy) {
        for (const order of options.orderBy) {
          query = query.orderBy(order.field, order.direction);
        }
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Apply offset
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // Apply field selection
      if (options.select) {
        query = query.select(...options.select);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Firestore query error', { collection, options, error });
      throw error;
    }
  }

  async firestoreBatchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    documentId: string;
    data?: any;
  }>): Promise<void> {
    const batch = this.firestore.batch();

    for (const op of operations) {
      const docRef = this.firestore.collection(op.collection).doc(op.documentId);
      
      switch (op.type) {
        case 'set':
          batch.set(docRef, op.data);
          break;
        case 'update':
          batch.update(docRef, op.data);
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    }

    await batch.commit();
  }

  async firestoreTransaction<T>(
    transactionFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    return await this.firestore.runTransaction(transactionFn);
  }

  // BigQuery Operations
  async bigqueryQuery(query: string, params?: any[]): Promise<any[]> {
    try {
      const options = {
        query,
        location: this.config.region,
        params,
      };

      const [job] = await this.bigquery.createQueryJob(options);
      const [rows] = await job.getQueryResults();
      
      return rows;
    } catch (error) {
      logger.error('BigQuery query error', { query, error });
      throw error;
    }
  }

  async bigqueryInsert(datasetId: string, tableId: string, rows: any[]): Promise<void> {
    try {
      const dataset = this.bigquery.dataset(datasetId);
      const table = dataset.table(tableId);
      
      await table.insert(rows);
    } catch (error) {
      logger.error('BigQuery insert error', { datasetId, tableId, error });
      throw error;
    }
  }

  async bigqueryStreamInsert(datasetId: string, tableId: string, stream: NodeJS.ReadableStream): Promise<void> {
    try {
      const dataset = this.bigquery.dataset(datasetId);
      const table = dataset.table(tableId);
      
      const writeStream = table.createWriteStream();
      
      return new Promise((resolve, reject) => {
        stream
          .pipe(writeStream)
          .on('error', reject)
          .on('finish', resolve);
      });
    } catch (error) {
      logger.error('BigQuery stream insert error', { datasetId, tableId, error });
      throw error;
    }
  }

  async bigqueryExport(datasetId: string, tableId: string, destinationUri: string, format: 'CSV' | 'JSON' | 'AVRO' = 'CSV'): Promise<void> {
    try {
      const dataset = this.bigquery.dataset(datasetId);
      const table = dataset.table(tableId);
      
      const exportOptions = {
        format,
        gzip: true,
      };

      const [job] = await table.export(destinationUri, exportOptions);
      await job.promise();
    } catch (error) {
      logger.error('BigQuery export error', { datasetId, tableId, destinationUri, error });
      throw error;
    }
  }

  async bigqueryImport(datasetId: string, tableId: string, sourceUri: string, schema?: any[]): Promise<void> {
    try {
      const dataset = this.bigquery.dataset(datasetId);
      const table = dataset.table(tableId);
      
      const metadata = {
        sourceUris: [sourceUri],
        autodetect: !schema,
        schema: schema ? { fields: schema } : undefined,
      };

      const [job] = await table.import(sourceUri, metadata);
      await job.promise();
    } catch (error) {
      logger.error('BigQuery import error', { datasetId, tableId, sourceUri, error });
      throw error;
    }
  }

  // Redis Cache Operations
  async cacheGet<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.getCacheKey(key, options.namespace);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async cacheSet<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getCacheKey(key, options.namespace);
      const serialized = JSON.stringify(value);
      
      if (options.ttl) {
        await this.redis.setex(fullKey, options.ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  async cacheDelete(key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getCacheKey(key, options.namespace);
      await this.redis.del(fullKey);
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  async cacheFlush(namespace?: string): Promise<void> {
    try {
      const pattern = namespace 
        ? `${this.cacheNamespace}:${namespace}:*`
        : `${this.cacheNamespace}:*`;
      
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache flush error', { namespace, error });
    }
  }

  private getCacheKey(key: string, namespace?: string): string {
    return namespace 
      ? `${this.cacheNamespace}:${namespace}:${key}`
      : `${this.cacheNamespace}:${key}`;
  }

  // Storage Operations
  async storageUpload(bucketName: string, filePath: string, buffer: Buffer, metadata?: any): Promise<string> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);
      
      await file.save(buffer, {
        metadata,
        resumable: false,
      });

      // Make the file public if needed
      if (metadata?.public) {
        await file.makePublic();
      }

      return file.publicUrl();
    } catch (error) {
      logger.error('Storage upload error', { bucketName, filePath, error });
      throw error;
    }
  }

  async storageDownload(bucketName: string, filePath: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      logger.error('Storage download error', { bucketName, filePath, error });
      throw error;
    }
  }

  async storageDelete(bucketName: string, filePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);
      
      await file.delete();
    } catch (error) {
      logger.error('Storage delete error', { bucketName, filePath, error });
      throw error;
    }
  }

  async storageList(bucketName: string, prefix?: string): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const [files] = await bucket.getFiles({ prefix });
      
      return files.map(file => file.name);
    } catch (error) {
      logger.error('Storage list error', { bucketName, prefix, error });
      throw error;
    }
  }

  async storageGenerateSignedUrl(bucketName: string, filePath: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });
      
      return url;
    } catch (error) {
      logger.error('Storage signed URL error', { bucketName, filePath, error });
      throw error;
    }
  }

  // Datastore Operations (Legacy support)
  async datastoreGet(kind: string, id: string | number): Promise<Entity | null> {
    try {
      const key = this.datastore.key([kind, id]);
      const [entity] = await this.datastore.get(key);
      
      return entity || null;
    } catch (error) {
      logger.error('Datastore get error', { kind, id, error });
      throw error;
    }
  }

  async datastoreSave(kind: string, id: string | number, data: any): Promise<void> {
    try {
      const key = this.datastore.key([kind, id]);
      const entity = {
        key,
        data,
      };
      
      await this.datastore.save(entity);
    } catch (error) {
      logger.error('Datastore save error', { kind, id, error });
      throw error;
    }
  }

  async datastoreQuery(kind: string, filters: { [key: string]: any } = {}, limit?: number): Promise<Entity[]> {
    try {
      let query = this.datastore.createQuery(kind);
      
      // Apply filters
      for (const [field, value] of Object.entries(filters)) {
        query = query.filter(field, '=', value);
      }
      
      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }
      
      const [entities] = await this.datastore.runQuery(query);
      return entities;
    } catch (error) {
      logger.error('Datastore query error', { kind, filters, error });
      throw error;
    }
  }

  // Cross-service data operations
  async syncFirestoreToBigQuery(
    collection: string,
    datasetId: string,
    tableId: string,
    transform?: (doc: any) => any
  ): Promise<void> {
    try {
      // Read all documents from Firestore
      const docs = await this.firestoreQuery(collection);
      
      // Transform documents if needed
      const rows = docs.map(doc => transform ? transform(doc) : doc);
      
      // Insert into BigQuery
      await this.bigqueryInsert(datasetId, tableId, rows);
      
      logger.info('Synced Firestore to BigQuery', { 
        collection, 
        datasetId, 
        tableId, 
        count: rows.length 
      });
    } catch (error) {
      logger.error('Firestore to BigQuery sync error', { error });
      throw error;
    }
  }

  async cacheWarmup(queries: Array<{
    key: string;
    fn: () => Promise<any>;
    ttl?: number;
  }>): Promise<void> {
    const promises = queries.map(async ({ key, fn, ttl }) => {
      try {
        const data = await fn();
        await this.cacheSet(key, data, { ttl });
      } catch (error) {
        logger.error('Cache warmup error', { key, error });
      }
    });

    await Promise.all(promises);
  }

  // Data migration utilities
  async migrateCollection(
    sourceCollection: string,
    targetCollection: string,
    transform?: (doc: any) => any,
    batchSize: number = 500
  ): Promise<void> {
    const sourceRef = this.firestore.collection(sourceCollection);
    const targetRef = this.firestore.collection(targetCollection);
    
    let lastDoc: any = null;
    let migrated = 0;

    while (true) {
      let query = sourceRef.limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }

      const batch = this.firestore.batch();
      
      snapshot.docs.forEach(doc => {
        const data = transform ? transform(doc.data()) : doc.data();
        const targetDoc = targetRef.doc(doc.id);
        batch.set(targetDoc, data);
      });

      await batch.commit();
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      migrated += snapshot.docs.length;
      
      logger.info(`Migrated ${migrated} documents from ${sourceCollection} to ${targetCollection}`);
    }
  }

  // Cleanup
  async close(): Promise<void> {
    await this.redis.quit();
    await this.firestore.terminate();
  }
}