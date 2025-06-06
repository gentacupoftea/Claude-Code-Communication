import { ContainerClient } from '@google-cloud/container';
import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { CloudRunClient } from '@google-cloud/run';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '../config/logger';
import * as k8s from '@kubernetes/client-node';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface MicroserviceConfig {
  name: string;
  image: string;
  replicas: number;
  port: number;
  env: Record<string, string>;
  resources: {
    cpu: string;
    memory: string;
  };
  healthCheck?: {
    path: string;
    interval: number;
    timeout: number;
  };
  autoscaling?: {
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
    targetMemory: number;
  };
}

interface DeploymentResult {
  serviceName: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  endpoint?: string;
  message?: string;
  timestamp: Date;
}

export class MicroserviceManager {
  private containerClient: ContainerClient;
  private cloudBuildClient: CloudBuildClient;
  private cloudRunClient: CloudRunClient;
  private secretManagerClient: SecretManagerServiceClient;
  private k8sClient: k8s.KubeConfig;
  private projectId: string;
  private region: string;
  private clusterName: string;
  private services: Map<string, MicroserviceConfig> = new Map();

  constructor(projectId: string, region: string, clusterName: string) {
    this.projectId = projectId;
    this.region = region;
    this.clusterName = clusterName;
    
    this.containerClient = new ContainerClient();
    this.cloudBuildClient = new CloudBuildClient();
    this.cloudRunClient = new CloudRunClient();
    this.secretManagerClient = new SecretManagerServiceClient();
    
    this.k8sClient = new k8s.KubeConfig();
    this.initializeKubernetesClient();
  }

  private async initializeKubernetesClient(): Promise<void> {
    try {
      // Get cluster credentials
      const [cluster] = await this.containerClient.getCluster({
        name: `projects/${this.projectId}/locations/${this.region}/clusters/${this.clusterName}`
      });

      if (!cluster.endpoint || !cluster.masterAuth?.clusterCaCertificate) {
        throw new Error('Failed to get cluster credentials');
      }

      // Configure kubectl
      const contextName = `gke_${this.projectId}_${this.region}_${this.clusterName}`;
      this.k8sClient.loadFromClusterAndUser({
        name: contextName,
        server: `https://${cluster.endpoint}`,
        caData: cluster.masterAuth.clusterCaCertificate
      }, {
        name: contextName,
        authProvider: {
          name: 'gcp',
          config: {
            'access-token': await this.getAccessToken(),
            'cmd-path': 'gcloud',
            'cmd-args': 'config config-helper --format=json',
            'expiry-key': '{.credential.token_expiry}',
            'token-key': '{.credential.access_token}'
          }
        }
      });

      this.k8sClient.setCurrentContext(contextName);
      logger.info('Kubernetes client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Kubernetes client', { error });
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    // This would typically use Google Auth Library to get an access token
    // For now, returning a placeholder
    return 'access-token-placeholder';
  }

  // Service Registration
  registerService(config: MicroserviceConfig): void {
    this.services.set(config.name, config);
    logger.info(`Registered microservice: ${config.name}`);
  }

  // Build and Deploy Pipeline
  async buildAndDeploy(serviceName: string): Promise<DeploymentResult> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    try {
      // 1. Build the container image
      const imageTag = await this.buildImage(service);
      
      // 2. Deploy to GKE
      await this.deployToGKE(service, imageTag);
      
      // 3. Setup networking (Service, Ingress)
      const endpoint = await this.setupNetworking(service);
      
      // 4. Configure monitoring
      await this.configureMonitoring(service);

      return {
        serviceName: service.name,
        status: 'SUCCESS',
        endpoint,
        timestamp: new Date()
      };
    } catch (error: unknown) {
      logger.error(`Failed to deploy ${serviceName}`, { error });
      return {
        serviceName: service.name,
        status: 'FAILED',
        message: error.message,
        timestamp: new Date()
      };
    }
  }

  // Container Building
  private async buildImage(service: MicroserviceConfig): Promise<string> {
    const buildId = `build-${service.name}-${Date.now()}`;
    const imageTag = `gcr.io/${this.projectId}/${service.name}:${buildId}`;

    const buildConfig = {
      projectId: this.projectId,
      build: {
        id: buildId,
        source: {
          storageSource: {
            bucket: `${this.projectId}-source`,
            object: `${service.name}/source.tar.gz`
          }
        },
        steps: [
          {
            name: 'gcr.io/cloud-builders/docker',
            args: ['build', '-t', imageTag, '.']
          },
          {
            name: 'gcr.io/cloud-builders/docker',
            args: ['push', imageTag]
          }
        ],
        images: [imageTag],
        options: {
          machineType: 'N1_HIGHCPU_8',
          diskSizeGb: 100,
          substitutionOption: 'ALLOW_LOOSE'
        },
        timeout: '1200s'
      }
    };

    const [operation] = await this.cloudBuildClient.createBuild(buildConfig);
    await this.waitForBuildCompletion(operation);

    logger.info(`Built container image: ${imageTag}`);
    return imageTag;
  }

  private async waitForBuildCompletion(operation: unknown): Promise<void> {
    // Poll for build completion
    let build;
    do {
      await new Promise(resolve => setTimeout(resolve, 5000));
      [build] = await this.cloudBuildClient.getBuild({ id: operation.metadata.build.id });
    } while (build.status === 'WORKING' || build.status === 'QUEUED');

    if (build.status !== 'SUCCESS') {
      throw new Error(`Build failed with status: ${build.status}`);
    }
  }

  // Kubernetes Deployment
  private async deployToGKE(service: MicroserviceConfig, imageTag: string): Promise<void> {
    const k8sAppsClient = this.k8sClient.makeApiClient(k8s.AppsV1Api);
    const k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);

    // Create namespace if it doesn't exist
    const namespace = 'shopify-mcp';
    try {
      await k8sCoreClient.createNamespace({
        metadata: { name: namespace }
      });
    } catch (error: unknown) {
      if (error.statusCode !== 409) { // Namespace already exists
        throw error;
      }
    }

    // Create deployment
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: service.name,
        namespace,
        labels: {
          app: service.name,
          project: 'shopify-mcp'
        }
      },
      spec: {
        replicas: service.replicas,
        selector: {
          matchLabels: {
            app: service.name
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: 'v1'
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: imageTag,
              ports: [{
                containerPort: service.port
              }],
              env: Object.entries(service.env).map(([name, value]) => ({ name, value })),
              resources: {
                requests: {
                  cpu: service.resources.cpu,
                  memory: service.resources.memory
                },
                limits: {
                  cpu: service.resources.cpu,
                  memory: service.resources.memory
                }
              },
              livenessProbe: service.healthCheck ? {
                httpGet: {
                  path: service.healthCheck.path,
                  port: service.port
                },
                initialDelaySeconds: 30,
                periodSeconds: service.healthCheck.interval,
                timeoutSeconds: service.healthCheck.timeout
              } : undefined,
              readinessProbe: service.healthCheck ? {
                httpGet: {
                  path: service.healthCheck.path,
                  port: service.port
                },
                initialDelaySeconds: 10,
                periodSeconds: 5
              } : undefined
            }],
            serviceAccountName: 'shopify-mcp-runtime'
          }
        }
      }
    };

    try {
      await k8sAppsClient.createNamespacedDeployment(namespace, deployment);
      logger.info(`Created deployment for ${service.name}`);
    } catch (error: unknown) {
      if (error.statusCode === 409) { // Deployment already exists
        await k8sAppsClient.patchNamespacedDeployment(
          service.name,
          namespace,
          deployment,
          undefined,
          undefined,
          undefined,
          undefined,
          { headers: { 'Content-Type': 'application/merge-patch+json' } }
        );
        logger.info(`Updated deployment for ${service.name}`);
      } else {
        throw error;
      }
    }

    // Setup HPA if autoscaling is configured
    if (service.autoscaling) {
      await this.setupAutoscaling(service, namespace);
    }
  }

  private async setupAutoscaling(service: MicroserviceConfig, namespace: string): Promise<void> {
    const k8sAutoscalingClient = this.k8sClient.makeApiClient(k8s.AutoscalingV2Api);

    const hpa: k8s.V1HorizontalPodAutoscaler = {
      metadata: {
        name: `${service.name}-hpa`,
        namespace
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: service.name
        },
        minReplicas: service.autoscaling!.minReplicas,
        maxReplicas: service.autoscaling!.maxReplicas,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: service.autoscaling!.targetCPU
              }
            }
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: service.autoscaling!.targetMemory
              }
            }
          }
        ]
      }
    };

    try {
      await k8sAutoscalingClient.createNamespacedHorizontalPodAutoscaler(namespace, hpa);
      logger.info(`Created HPA for ${service.name}`);
    } catch (error: unknown) {
      if (error.statusCode === 409) { // HPA already exists
        await k8sAutoscalingClient.patchNamespacedHorizontalPodAutoscaler(
          `${service.name}-hpa`,
          namespace,
          hpa,
          undefined,
          undefined,
          undefined,
          undefined,
          { headers: { 'Content-Type': 'application/merge-patch+json' } }
        );
        logger.info(`Updated HPA for ${service.name}`);
      } else {
        throw error;
      }
    }
  }

  // Networking Setup
  private async setupNetworking(service: MicroserviceConfig): Promise<string> {
    const k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);
    const k8sNetworkingClient = this.k8sClient.makeApiClient(k8s.NetworkingV1Api);
    const namespace = 'shopify-mcp';

    // Create Service
    const k8sService: k8s.V1Service = {
      metadata: {
        name: service.name,
        namespace,
        labels: {
          app: service.name
        }
      },
      spec: {
        selector: {
          app: service.name
        },
        ports: [{
          port: 80,
          targetPort: service.port,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    try {
      await k8sCoreClient.createNamespacedService(namespace, k8sService);
      logger.info(`Created service for ${service.name}`);
    } catch (error: unknown) {
      if (error.statusCode !== 409) { // Service already exists
        throw error;
      }
    }

    // Create Ingress
    const ingress: k8s.V1Ingress = {
      metadata: {
        name: `${service.name}-ingress`,
        namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/rate-limit': '100',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true'
        }
      },
      spec: {
        tls: [{
          hosts: [`${service.name}.api.shopify-mcp.com`],
          secretName: `${service.name}-tls`
        }],
        rules: [{
          host: `${service.name}.api.shopify-mcp.com`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: service.name,
                  port: {
                    number: 80
                  }
                }
              }
            }]
          }
        }]
      }
    };

    try {
      await k8sNetworkingClient.createNamespacedIngress(namespace, ingress);
      logger.info(`Created ingress for ${service.name}`);
    } catch (error: unknown) {
      if (error.statusCode !== 409) { // Ingress already exists
        throw error;
      }
    }

    return `https://${service.name}.api.shopify-mcp.com`;
  }

  // Monitoring Configuration
  private async configureMonitoring(service: MicroserviceConfig): Promise<void> {
    const _k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);
    const namespace = 'shopify-mcp';

    // Create ServiceMonitor for Prometheus
    const serviceMonitor = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      metadata: {
        name: `${service.name}-monitor`,
        namespace,
        labels: {
          app: service.name
        }
      },
      spec: {
        selector: {
          matchLabels: {
            app: service.name
          }
        },
        endpoints: [{
          port: 'metrics',
          interval: '30s',
          path: '/metrics'
        }]
      }
    };

    // Apply ServiceMonitor using kubectl
    await this.applyKubernetesManifest(serviceMonitor);

    // Configure alerts
    const alertRule = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        name: `${service.name}-alerts`,
        namespace,
        labels: {
          app: service.name
        }
      },
      spec: {
        groups: [{
          name: `${service.name}.rules`,
          interval: '30s',
          rules: [
            {
              alert: 'ServiceDown',
              expr: `up{service="${service.name}"} == 0`,
              for: '5m',
              labels: {
                severity: 'critical',
                service: service.name
              },
              annotations: {
                summary: `Service ${service.name} is down`,
                description: `Service ${service.name} has been down for more than 5 minutes`
              }
            },
            {
              alert: 'HighErrorRate',
              expr: `rate(http_requests_total{service="${service.name}",status=~"5.."}[5m]) > 0.05`,
              for: '5m',
              labels: {
                severity: 'warning',
                service: service.name
              },
              annotations: {
                summary: `High error rate for ${service.name}`,
                description: `Service ${service.name} has error rate above 5%`
              }
            }
          ]
        }]
      }
    };

    await this.applyKubernetesManifest(alertRule);
    logger.info(`Configured monitoring for ${service.name}`);
  }

  private async applyKubernetesManifest(manifest: unknown): Promise<void> {
    // This would typically use kubectl apply or the Kubernetes dynamic client
    // For now, we'll save it to a file and apply it
    const filename = `${manifest.metadata.name}.yaml`;
    const filepath = path.join('/tmp', filename);
    
    await fs.writeFile(filepath, yaml.dump(manifest));
    
    // Apply using kubectl
    import { exec  } from 'child_process';
    await new Promise((resolve, reject) => {
      exec(`kubectl apply -f ${filepath}`, (error: unknown, stdout: string, stderr: string) => {
        if (error) {
          logger.error('Failed to apply Kubernetes manifest', { error, stderr });
          reject(error);
        } else {
          logger.info('Applied Kubernetes manifest', { stdout });
          resolve(stdout);
        }
      });
    });
  }

  // Service Discovery
  async discoverServices(): Promise<MicroserviceConfig[]> {
    const k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);
    const namespace = 'shopify-mcp';

    try {
      const { body: services } = await k8sCoreClient.listNamespacedService(namespace);
      
      return services.items
        .filter((svc: unknown) => svc.metadata?.labels?.project === 'shopify-mcp')
        .map((svc: unknown) => ({
          name: svc.metadata!.name!,
          image: '', // Would need to fetch from deployment
          replicas: 1,
          port: svc.spec?.ports?.[0]?.targetPort as number || 80,
          env: {},
          resources: {
            cpu: '250m',
            memory: '512Mi'
          }
        }));
    } catch (error) {
      logger.error('Failed to discover services', { error });
      return [];
    }
  }

  // Rollback
  async rollback(serviceName: string, revision: number): Promise<void> {
    const k8sAppsClient = this.k8sClient.makeApiClient(k8s.AppsV1Api);
    const namespace = 'shopify-mcp';

    try {
      // Get deployment history
      const { body: replicaSets } = await k8sAppsClient.listNamespacedReplicaSet(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${serviceName}`
      );

      // Find the replica set for the specified revision
      const targetRS = replicaSets.items[revision];
      if (!targetRS) {
        throw new Error(`Revision ${revision} not found for ${serviceName}`);
      }

      // Update deployment to use the old replica set's template
      const deployment = await k8sAppsClient.readNamespacedDeployment(serviceName, namespace);
      deployment.body.spec!.template = targetRS.spec!.template!;

      await k8sAppsClient.patchNamespacedDeployment(
        serviceName,
        namespace,
        deployment.body,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      logger.info(`Rolled back ${serviceName} to revision ${revision}`);
    } catch (error) {
      logger.error(`Failed to rollback ${serviceName}`, { error });
      throw error;
    }
  }

  // Scaling
  async scale(serviceName: string, replicas: number): Promise<void> {
    const k8sAppsClient = this.k8sClient.makeApiClient(k8s.AppsV1Api);
    const namespace = 'shopify-mcp';

    try {
      const patch = {
        spec: {
          replicas
        }
      };

      await k8sAppsClient.patchNamespacedDeployment(
        serviceName,
        namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      logger.info(`Scaled ${serviceName} to ${replicas} replicas`);
    } catch (error) {
      logger.error(`Failed to scale ${serviceName}`, { error });
      throw error;
    }
  }

  // Service mesh integration (Istio)
  async enableServiceMesh(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    // Create Istio VirtualService
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${service.name}-vs`,
        namespace: 'shopify-mcp'
      },
      spec: {
        hosts: [`${service.name}.api.shopify-mcp.com`],
        http: [{
          match: [{
            uri: {
              prefix: '/'
            }
          }],
          route: [{
            destination: {
              host: service.name,
              port: {
                number: 80
              }
            },
            weight: 100
          }],
          timeout: '30s',
          retries: {
            attempts: 3,
            perTryTimeout: '10s',
            retryOn: '5xx,reset,connect-failure,refused-stream'
          }
        }]
      }
    };

    await this.applyKubernetesManifest(virtualService);

    // Create DestinationRule
    const destinationRule = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'DestinationRule',
      metadata: {
        name: `${service.name}-dr`,
        namespace: 'shopify-mcp'
      },
      spec: {
        host: service.name,
        trafficPolicy: {
          connectionPool: {
            tcp: {
              maxConnections: 100
            },
            http: {
              http1MaxPendingRequests: 100,
              http2MaxRequests: 100
            }
          },
          loadBalancer: {
            simple: 'ROUND_ROBIN'
          },
          outlierDetection: {
            consecutiveErrors: 5,
            interval: '30s',
            baseEjectionTime: '30s',
            minHealthPercent: 30
          }
        }
      }
    };

    await this.applyKubernetesManifest(destinationRule);
    logger.info(`Enabled service mesh for ${service.name}`);
  }

  // Canary deployments
  async canaryDeploy(serviceName: string, newImageTag: string, trafficPercentage: number): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    // Create new deployment for canary
    const canaryName = `${serviceName}-canary`;
    const canaryService = {
      ...service,
      name: canaryName,
      replicas: Math.ceil(service.replicas * (trafficPercentage / 100))
    };

    // Deploy canary version
    await this.deployToGKE(canaryService, newImageTag);

    // Update Istio VirtualService to split traffic
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${service.name}-vs`,
        namespace: 'shopify-mcp'
      },
      spec: {
        hosts: [`${service.name}.api.shopify-mcp.com`],
        http: [{
          route: [
            {
              destination: {
                host: service.name,
                port: {
                  number: 80
                }
              },
              weight: 100 - trafficPercentage
            },
            {
              destination: {
                host: canaryName,
                port: {
                  number: 80
                }
              },
              weight: trafficPercentage
            }
          ]
        }]
      }
    };

    await this.applyKubernetesManifest(virtualService);
    logger.info(`Deployed canary for ${serviceName} with ${trafficPercentage}% traffic`);
  }

  // Secret management
  async createSecret(name: string, data: Record<string, string>): Promise<void> {
    // Create secret in Secret Manager
    const parent = `projects/${this.projectId}`;
    const secretId = `${name}-secret`;

    try {
      const [secret] = await this.secretManagerClient.createSecret({
        parent,
        secretId,
        secret: {
          replication: {
            automatic: {}
          }
        }
      });

      // Add secret version
      const payload = Buffer.from(JSON.stringify(data), 'utf8');
      const [_version] = await this.secretManagerClient.addSecretVersion({
        parent: secret.name,
        payload: {
          data: payload
        }
      });

      logger.info(`Created secret: ${secretId}`);
    } catch (error: unknown) {
      if (error.code !== 6) { // Secret already exists
        throw error;
      }
    }

    // Create Kubernetes secret
    const k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);
    const k8sSecret: k8s.V1Secret = {
      metadata: {
        name: name,
        namespace: 'shopify-mcp'
      },
      stringData: data,
      type: 'Opaque'
    };

    try {
      await k8sCoreClient.createNamespacedSecret('shopify-mcp', k8sSecret);
    } catch (error: unknown) {
      if (error.statusCode !== 409) { // Secret already exists
        throw error;
      }
    }
  }

  // Health monitoring
  async getServiceHealth(serviceName: string): Promise<unknown> {
    const k8sAppsClient = this.k8sClient.makeApiClient(k8s.AppsV1Api);
    const k8sCoreClient = this.k8sClient.makeApiClient(k8s.CoreV1Api);
    const namespace = 'shopify-mcp';

    try {
      // Get deployment status
      const { body: deployment } = await k8sAppsClient.readNamespacedDeploymentStatus(
        serviceName,
        namespace
      );

      // Get pods
      const { body: pods } = await k8sCoreClient.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${serviceName}`
      );

      // Get service endpoints
      const { body: endpoints } = await k8sCoreClient.readNamespacedEndpoints(
        serviceName,
        namespace
      );

      return {
        deployment: {
          name: deployment.metadata?.name,
          replicas: deployment.status?.replicas,
          readyReplicas: deployment.status?.readyReplicas,
          updatedReplicas: deployment.status?.updatedReplicas,
          availableReplicas: deployment.status?.availableReplicas
        },
        pods: pods.items.map((pod: unknown) => ({
          name: pod.metadata?.name,
          phase: pod.status?.phase,
          ready: pod.status?.conditions?.find((c: unknown) => c.type === 'Ready')?.status === 'True',
          restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          startTime: pod.status?.startTime
        })),
        endpoints: endpoints.subsets?.map((subset: unknown) => ({
          addresses: subset.addresses?.length || 0,
          ports: subset.ports?.map((p: unknown) => p.port)
        }))
      };
    } catch (error) {
      logger.error(`Failed to get health for ${serviceName}`, { error });
      throw error;
    }
  }
}