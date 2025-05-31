import { 
  ProjectsClient,
  CloudResourceManager,
  ServiceUsageClient,
  CloudBuildClient,
  ContainerClient,
  FirestoreAdminClient,
  CloudFunctionsClient
} from '@google-cloud/resource-manager';
import { Storage } from '@google-cloud/storage';
import { BigQuery } from '@google-cloud/bigquery';
import { Compute } from '@google-cloud/compute';
import { logger } from '../config/logger';

interface GCPResourceConfig {
  projectId: string;
  region: string;
  zones: string[];
  enabledAPIs: string[];
  labels: Record<string, string>;
}

interface ResourceStatus {
  resourceType: string;
  resourceId: string;
  status: 'CREATING' | 'ACTIVE' | 'UPDATING' | 'DELETING' | 'ERROR';
  metadata?: any;
}

export class GCPInfraManager {
  private projectsClient: ProjectsClient;
  private serviceUsageClient: ServiceUsageClient;
  private cloudBuildClient: CloudBuildClient;
  private containerClient: ContainerClient;
  private firestoreClient: FirestoreAdminClient;
  private functionsClient: CloudFunctionsClient;
  private storage: Storage;
  private bigquery: BigQuery;
  private compute: Compute;
  private config: GCPResourceConfig;
  private resourceTracking: Map<string, ResourceStatus> = new Map();

  constructor(config: GCPResourceConfig) {
    this.config = config;
    this.projectsClient = new ProjectsClient();
    this.serviceUsageClient = new ServiceUsageClient();
    this.cloudBuildClient = new CloudBuildClient();
    this.containerClient = new ContainerClient();
    this.firestoreClient = new FirestoreAdminClient();
    this.functionsClient = new CloudFunctionsClient();
    this.storage = new Storage({ projectId: config.projectId });
    this.bigquery = new BigQuery({ projectId: config.projectId });
    this.compute = new Compute({ projectId: config.projectId });
  }

  // Project and API Management
  async initializeProject(): Promise<void> {
    try {
      logger.info('Initializing GCP project infrastructure', { projectId: this.config.projectId });

      // Enable required APIs
      await this.enableRequiredAPIs();

      // Setup networking
      await this.setupNetworking();

      // Setup service accounts
      await this.setupServiceAccounts();

      // Setup initial storage buckets
      await this.setupStorageBuckets();

      // Setup Firestore
      await this.setupFirestore();

      // Setup BigQuery datasets
      await this.setupBigQuery();

      logger.info('GCP project infrastructure initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize GCP project infrastructure', { error });
      throw error;
    }
  }

  private async enableRequiredAPIs(): Promise<void> {
    const requiredAPIs = [
      'cloudbuild.googleapis.com',
      'compute.googleapis.com',
      'container.googleapis.com',
      'firestore.googleapis.com',
      'cloudfunctions.googleapis.com',
      'storage-component.googleapis.com',
      'bigquery.googleapis.com',
      'cloudkms.googleapis.com',
      'cloudtrace.googleapis.com',
      'logging.googleapis.com',
      'monitoring.googleapis.com',
      'run.googleapis.com',
      'redis.googleapis.com',
      'secretmanager.googleapis.com',
      ...this.config.enabledAPIs
    ];

    for (const api of requiredAPIs) {
      try {
        await this.serviceUsageClient.enableService({
          name: `projects/${this.config.projectId}/services/${api}`
        });
        logger.info(`Enabled API: ${api}`);
      } catch (error: any) {
        if (error.code !== 7) { // API already enabled
          logger.error(`Failed to enable API: ${api}`, { error });
          throw error;
        }
      }
    }
  }

  // Networking Setup
  private async setupNetworking(): Promise<void> {
    try {
      // Create VPC network with custom subnets for each region
      const network = await this.compute.networks.insert({
        name: 'shopify-mcp-network',
        autoCreateSubnetworks: false,
        description: 'Main network for Shopify MCP Server',
        routingConfig: {
          routingMode: 'REGIONAL'
        }
      });

      // Create subnets for each region
      const regions = ['asia-northeast1', 'us-central1', 'europe-west1'];
      for (const region of regions) {
        const subnetName = `shopify-mcp-subnet-${region}`;
        await this.compute.subnetworks.insert({
          name: subnetName,
          network: network.selfLink,
          region: region,
          ipCidrRange: this.getCidrForRegion(region),
          privateIpGoogleAccess: true,
          enableFlowLogs: true
        });
      }

      // Setup firewall rules
      await this.setupFirewallRules();

      logger.info('Networking setup completed');
    } catch (error) {
      logger.error('Failed to setup networking', { error });
      throw error;
    }
  }

  private getCidrForRegion(region: string): string {
    const cidrMap: Record<string, string> = {
      'asia-northeast1': '10.1.0.0/16',
      'us-central1': '10.2.0.0/16',
      'europe-west1': '10.3.0.0/16'
    };
    return cidrMap[region] || '10.0.0.0/16';
  }

  private async setupFirewallRules(): Promise<void> {
    const firewallRules = [
      {
        name: 'allow-internal',
        sourceRanges: ['10.0.0.0/8'],
        allowed: [{ IPProtocol: 'tcp' }, { IPProtocol: 'udp' }, { IPProtocol: 'icmp' }],
        priority: 1000
      },
      {
        name: 'allow-health-checks',
        sourceRanges: ['130.211.0.0/22', '35.191.0.0/16'],
        allowed: [{ IPProtocol: 'tcp', ports: ['80', '443'] }],
        priority: 1100
      },
      {
        name: 'allow-ssh',
        sourceRanges: ['0.0.0.0/0'],
        allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
        targetTags: ['ssh-enabled'],
        priority: 1200
      }
    ];

    for (const rule of firewallRules) {
      try {
        await this.compute.firewalls.insert({
          name: rule.name,
          network: `projects/${this.config.projectId}/global/networks/shopify-mcp-network`,
          ...rule
        });
        logger.info(`Created firewall rule: ${rule.name}`);
      } catch (error: any) {
        if (error.code !== 409) { // Rule already exists
          logger.error(`Failed to create firewall rule: ${rule.name}`, { error });
          throw error;
        }
      }
    }
  }

  // Service Account Setup
  private async setupServiceAccounts(): Promise<void> {
    const serviceAccounts = [
      {
        accountId: 'shopify-mcp-runtime',
        displayName: 'Shopify MCP Runtime Service Account',
        roles: [
          'roles/compute.admin',
          'roles/container.admin',
          'roles/storage.admin',
          'roles/bigquery.admin',
          'roles/logging.logWriter',
          'roles/monitoring.metricWriter'
        ]
      },
      {
        accountId: 'shopify-mcp-deployer',
        displayName: 'Shopify MCP Deployment Service Account',
        roles: [
          'roles/cloudbuild.builds.editor',
          'roles/container.developer',
          'roles/storage.objectCreator'
        ]
      },
      {
        accountId: 'shopify-mcp-function',
        displayName: 'Shopify MCP Cloud Function Service Account',
        roles: [
          'roles/cloudfunctions.invoker',
          'roles/datastore.user',
          'roles/pubsub.publisher',
          'roles/secretmanager.secretAccessor'
        ]
      }
    ];

    for (const sa of serviceAccounts) {
      try {
        // Create service account
        const [serviceAccount] = await this.projectsClient.createServiceAccount({
          name: `projects/${this.config.projectId}`,
          serviceAccount: {
            accountId: sa.accountId,
            displayName: sa.displayName
          }
        });

        // Assign roles
        for (const role of sa.roles) {
          await this.projectsClient.setIamPolicy({
            resource: `projects/${this.config.projectId}`,
            policy: {
              bindings: [{
                role: role,
                members: [`serviceAccount:${serviceAccount.email}`]
              }]
            }
          });
        }

        logger.info(`Created service account: ${sa.accountId}`);
      } catch (error: any) {
        if (error.code !== 409) { // Service account already exists
          logger.error(`Failed to create service account: ${sa.accountId}`, { error });
          throw error;
        }
      }
    }
  }

  // Storage Setup
  private async setupStorageBuckets(): Promise<void> {
    const buckets = [
      {
        name: `${this.config.projectId}-data`,
        location: 'ASIA-NORTHEAST1',
        storageClass: 'STANDARD',
        purpose: 'Main data storage'
      },
      {
        name: `${this.config.projectId}-backups`,
        location: 'ASIA-NORTHEAST1',
        storageClass: 'NEARLINE',
        purpose: 'Backup storage'
      },
      {
        name: `${this.config.projectId}-exports`,
        location: 'ASIA-NORTHEAST1',
        storageClass: 'STANDARD',
        purpose: 'Export storage'
      },
      {
        name: `${this.config.projectId}-temp`,
        location: 'ASIA-NORTHEAST1',
        storageClass: 'STANDARD',
        purpose: 'Temporary storage',
        lifecycleRules: [{
          action: { type: 'Delete' },
          condition: { age: 7 }
        }]
      }
    ];

    for (const bucket of buckets) {
      try {
        await this.storage.createBucket(bucket.name, {
          location: bucket.location,
          storageClass: bucket.storageClass,
          labels: {
            purpose: bucket.purpose.toLowerCase().replace(/\s+/g, '_'),
            project: 'shopify-mcp-server'
          },
          lifecycle: bucket.lifecycleRules ? { rules: bucket.lifecycleRules } : undefined
        });
        logger.info(`Created storage bucket: ${bucket.name}`);
      } catch (error: any) {
        if (error.code !== 409) { // Bucket already exists
          logger.error(`Failed to create storage bucket: ${bucket.name}`, { error });
          throw error;
        }
      }
    }
  }

  // Firestore Setup
  private async setupFirestore(): Promise<void> {
    try {
      // Create Firestore database with Japanese regional configuration
      const databaseId = 'shopify-mcp-db';
      await this.firestoreClient.createDatabase({
        parent: `projects/${this.config.projectId}`,
        database: {
          name: `projects/${this.config.projectId}/databases/${databaseId}`,
          locationId: 'asia-northeast1',
          type: 'FIRESTORE_NATIVE',
          concurrencyMode: 'OPTIMISTIC',
          appEngineIntegrationMode: 'DISABLED'
        }
      });

      // Create composite indexes for common queries
      await this.createFirestoreIndexes(databaseId);

      logger.info('Firestore setup completed');
    } catch (error: any) {
      if (error.code !== 409) { // Database already exists
        logger.error('Failed to setup Firestore', { error });
        throw error;
      }
    }
  }

  private async createFirestoreIndexes(databaseId: string): Promise<void> {
    const indexes = [
      {
        collectionGroup: 'products',
        fields: [
          { fieldPath: 'shopId', order: 'ASCENDING' },
          { fieldPath: 'updatedAt', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'orders',
        fields: [
          { fieldPath: 'shopId', order: 'ASCENDING' },
          { fieldPath: 'platform', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'analytics',
        fields: [
          { fieldPath: 'shopId', order: 'ASCENDING' },
          { fieldPath: 'metricType', order: 'ASCENDING' },
          { fieldPath: 'timestamp', order: 'DESCENDING' }
        ]
      }
    ];

    for (const index of indexes) {
      try {
        await this.firestoreClient.createIndex({
          parent: `projects/${this.config.projectId}/databases/${databaseId}/collectionGroups/${index.collectionGroup}`,
          index: {
            fields: index.fields,
            queryScope: 'COLLECTION_GROUP'
          }
        });
        logger.info(`Created Firestore index for ${index.collectionGroup}`);
      } catch (error: any) {
        if (error.code !== 409) { // Index already exists
          logger.error(`Failed to create Firestore index for ${index.collectionGroup}`, { error });
          throw error;
        }
      }
    }
  }

  // BigQuery Setup
  private async setupBigQuery(): Promise<void> {
    const datasets = [
      {
        datasetId: 'shopify_data',
        location: 'asia-northeast1',
        description: 'Main Shopify data warehouse'
      },
      {
        datasetId: 'analytics',
        location: 'asia-northeast1',
        description: 'Analytics and reporting data'
      },
      {
        datasetId: 'ml_data',
        location: 'asia-northeast1',
        description: 'Machine learning datasets'
      }
    ];

    for (const dataset of datasets) {
      try {
        await this.bigquery.createDataset(dataset.datasetId, {
          location: dataset.location,
          description: dataset.description,
          labels: {
            project: 'shopify-mcp-server',
            environment: 'production'
          }
        });

        // Create initial tables
        await this.createBigQueryTables(dataset.datasetId);

        logger.info(`Created BigQuery dataset: ${dataset.datasetId}`);
      } catch (error: any) {
        if (error.code !== 409) { // Dataset already exists
          logger.error(`Failed to create BigQuery dataset: ${dataset.datasetId}`, { error });
          throw error;
        }
      }
    }
  }

  private async createBigQueryTables(datasetId: string): Promise<void> {
    const tables = {
      shopify_data: [
        {
          tableId: 'products',
          schema: [
            { name: 'id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'shop_id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'title', type: 'STRING', mode: 'REQUIRED' },
            { name: 'vendor', type: 'STRING', mode: 'NULLABLE' },
            { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
            { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
            { name: 'data', type: 'JSON', mode: 'NULLABLE' }
          ]
        },
        {
          tableId: 'orders',
          schema: [
            { name: 'id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'shop_id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'customer_id', type: 'STRING', mode: 'NULLABLE' },
            { name: 'total_price', type: 'FLOAT64', mode: 'REQUIRED' },
            { name: 'currency', type: 'STRING', mode: 'REQUIRED' },
            { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
            { name: 'data', type: 'JSON', mode: 'NULLABLE' }
          ]
        }
      ],
      analytics: [
        {
          tableId: 'metrics',
          schema: [
            { name: 'metric_id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'shop_id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'metric_type', type: 'STRING', mode: 'REQUIRED' },
            { name: 'value', type: 'FLOAT64', mode: 'REQUIRED' },
            { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
            { name: 'dimensions', type: 'JSON', mode: 'NULLABLE' }
          ]
        }
      ]
    };

    const datasetTables = tables[datasetId as keyof typeof tables] || [];
    for (const table of datasetTables) {
      try {
        await this.bigquery
          .dataset(datasetId)
          .createTable(table.tableId, {
            schema: table.schema,
            timePartitioning: {
              type: 'DAY',
              field: table.schema.find(f => f.type === 'TIMESTAMP')?.name
            }
          });
        logger.info(`Created BigQuery table: ${datasetId}.${table.tableId}`);
      } catch (error: any) {
        if (error.code !== 409) { // Table already exists
          logger.error(`Failed to create BigQuery table: ${datasetId}.${table.tableId}`, { error });
          throw error;
        }
      }
    }
  }

  // Kubernetes Cluster Management
  async createGKECluster(clusterName: string, region: string, config?: any): Promise<void> {
    const defaultConfig = {
      name: clusterName,
      location: region,
      initialNodeCount: 3,
      nodeConfig: {
        machineType: 'n2-standard-4',
        diskSizeGb: 100,
        oauthScopes: [
          'https://www.googleapis.com/auth/cloud-platform'
        ],
        metadata: {
          'disable-legacy-endpoints': 'true'
        },
        serviceAccount: `shopify-mcp-runtime@${this.config.projectId}.iam.gserviceaccount.com`
      },
      addonsConfig: {
        horizontalPodAutoscaling: { disabled: false },
        httpLoadBalancing: { disabled: false },
        kubernetesDashboard: { disabled: true },
        networkPolicyConfig: { disabled: false }
      },
      networkPolicy: {
        enabled: true,
        provider: 'CALICO'
      },
      ipAllocationPolicy: {
        useIpAliases: true
      },
      masterAuth: {
        clientCertificateConfig: { issueClientCertificate: false }
      }
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      this.trackResource('GKE_CLUSTER', clusterName, 'CREATING');
      
      await this.containerClient.createCluster({
        parent: `projects/${this.config.projectId}/locations/${region}`,
        cluster: finalConfig
      });

      this.trackResource('GKE_CLUSTER', clusterName, 'ACTIVE');
      logger.info(`Created GKE cluster: ${clusterName} in ${region}`);
    } catch (error) {
      this.trackResource('GKE_CLUSTER', clusterName, 'ERROR', { error });
      logger.error(`Failed to create GKE cluster: ${clusterName}`, { error });
      throw error;
    }
  }

  // Resource Tracking
  private trackResource(resourceType: string, resourceId: string, status: ResourceStatus['status'], metadata?: any): void {
    this.resourceTracking.set(`${resourceType}:${resourceId}`, {
      resourceType,
      resourceId,
      status,
      metadata
    });
  }

  // Cleanup and Resource Management
  async cleanup(): Promise<void> {
    logger.info('Starting GCP resource cleanup');

    // Cleanup in reverse order of creation
    try {
      // Delete Cloud Functions
      await this.cleanupCloudFunctions();

      // Delete GKE clusters
      await this.cleanupGKEClusters();

      // Delete BigQuery datasets
      await this.cleanupBigQuery();

      // Delete Firestore
      await this.cleanupFirestore();

      // Delete Storage buckets
      await this.cleanupStorage();

      // Delete firewall rules
      await this.cleanupFirewallRules();

      // Delete network
      await this.cleanupNetwork();

      logger.info('GCP resource cleanup completed');
    } catch (error) {
      logger.error('Error during GCP resource cleanup', { error });
      throw error;
    }
  }

  private async cleanupCloudFunctions(): Promise<void> {
    try {
      const [functions] = await this.functionsClient.listFunctions({
        parent: `projects/${this.config.projectId}/locations/-`
      });

      for (const func of functions) {
        if (func.name?.includes('shopify-mcp')) {
          await this.functionsClient.deleteFunction({ name: func.name });
          logger.info(`Deleted Cloud Function: ${func.name}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup Cloud Functions', { error });
    }
  }

  private async cleanupGKEClusters(): Promise<void> {
    for (const [key, resource] of this.resourceTracking) {
      if (resource.resourceType === 'GKE_CLUSTER') {
        try {
          await this.containerClient.deleteCluster({
            name: `projects/${this.config.projectId}/locations/${this.config.region}/clusters/${resource.resourceId}`
          });
          logger.info(`Deleted GKE cluster: ${resource.resourceId}`);
        } catch (error) {
          logger.error(`Failed to delete GKE cluster: ${resource.resourceId}`, { error });
        }
      }
    }
  }

  private async cleanupBigQuery(): Promise<void> {
    const datasets = await this.bigquery.getDatasets();
    for (const dataset of datasets[0]) {
      if (dataset.id?.startsWith('shopify_') || dataset.id?.startsWith('analytics')) {
        try {
          await dataset.delete({ force: true });
          logger.info(`Deleted BigQuery dataset: ${dataset.id}`);
        } catch (error) {
          logger.error(`Failed to delete BigQuery dataset: ${dataset.id}`, { error });
        }
      }
    }
  }

  private async cleanupFirestore(): Promise<void> {
    try {
      const [databases] = await this.firestoreClient.listDatabases({
        parent: `projects/${this.config.projectId}`
      });

      for (const database of databases) {
        if (database.name?.includes('shopify-mcp')) {
          await this.firestoreClient.deleteDatabase({ name: database.name });
          logger.info(`Deleted Firestore database: ${database.name}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup Firestore', { error });
    }
  }

  private async cleanupStorage(): Promise<void> {
    const [buckets] = await this.storage.getBuckets();
    for (const bucket of buckets) {
      if (bucket.name.startsWith(this.config.projectId)) {
        try {
          await bucket.deleteFiles({ force: true });
          await bucket.delete();
          logger.info(`Deleted storage bucket: ${bucket.name}`);
        } catch (error) {
          logger.error(`Failed to delete storage bucket: ${bucket.name}`, { error });
        }
      }
    }
  }

  private async cleanupFirewallRules(): Promise<void> {
    const [firewalls] = await this.compute.firewalls.list();
    for (const firewall of firewalls) {
      if (firewall.name?.startsWith('shopify-mcp') || firewall.name?.includes('allow-')) {
        try {
          await this.compute.firewalls.delete({ firewall: firewall.name });
          logger.info(`Deleted firewall rule: ${firewall.name}`);
        } catch (error) {
          logger.error(`Failed to delete firewall rule: ${firewall.name}`, { error });
        }
      }
    }
  }

  private async cleanupNetwork(): Promise<void> {
    try {
      // Delete subnets first
      const regions = ['asia-northeast1', 'us-central1', 'europe-west1'];
      for (const region of regions) {
        const subnetName = `shopify-mcp-subnet-${region}`;
        try {
          await this.compute.subnetworks.delete({
            subnetwork: subnetName,
            region: region
          });
          logger.info(`Deleted subnet: ${subnetName}`);
        } catch (error) {
          logger.error(`Failed to delete subnet: ${subnetName}`, { error });
        }
      }

      // Delete network
      await this.compute.networks.delete({ network: 'shopify-mcp-network' });
      logger.info('Deleted VPC network: shopify-mcp-network');
    } catch (error) {
      logger.error('Failed to cleanup network', { error });
    }
  }

  // Monitoring and Health Checks
  async getResourceHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {
      timestamp: new Date().toISOString(),
      resources: {}
    };

    for (const [key, resource] of this.resourceTracking) {
      health.resources[key] = {
        status: resource.status,
        metadata: resource.metadata
      };
    }

    return health;
  }

  // Cost Optimization
  async analyzeCosts(): Promise<any> {
    // Implementation would integrate with Cloud Billing API
    // This is a placeholder for cost analysis logic
    return {
      message: 'Cost analysis requires Cloud Billing API setup',
      recommendation: 'Enable preemptible nodes for non-critical workloads'
    };
  }
}