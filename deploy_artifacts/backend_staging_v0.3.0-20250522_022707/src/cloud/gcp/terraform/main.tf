terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
  
  backend "gcs" {
    bucket = "shopify-mcp-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "zones" {
  description = "GCP Zones"
  type        = list(string)
  default     = ["asia-northeast1-a", "asia-northeast1-b", "asia-northeast1-c"]
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Enable APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudrun.googleapis.com",
    "firestore.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "pubsub.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "redis.googleapis.com",
    "certificatemanager.googleapis.com",
    "iap.googleapis.com"
  ])
  
  service = each.value
  disable_on_destroy = false
}

# Networking
module "vpc" {
  source = "./modules/networking"
  
  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  vpc_name     = "shopify-mcp-vpc"
  subnet_cidr  = "10.0.0.0/20"
}

# GKE Cluster
module "gke" {
  source = "./modules/gke"
  
  project_id     = var.project_id
  region         = var.region
  zones          = var.zones
  cluster_name   = "shopify-mcp-cluster"
  vpc_network    = module.vpc.network_self_link
  vpc_subnetwork = module.vpc.subnetwork_self_link
  
  node_pools = {
    default = {
      machine_type = "n2-standard-4"
      min_nodes    = 3
      max_nodes    = 10
      disk_size_gb = 100
      preemptible  = false
    }
    spot = {
      machine_type = "n2-standard-4"
      min_nodes    = 0
      max_nodes    = 20
      disk_size_gb = 100
      preemptible  = true
    }
  }
}

# Service Accounts
module "service_accounts" {
  source = "./modules/iam"
  
  project_id  = var.project_id
  environment = var.environment
  
  service_accounts = {
    runtime = {
      display_name = "Shopify MCP Runtime"
      roles = [
        "roles/compute.admin",
        "roles/container.admin",
        "roles/storage.admin",
        "roles/bigquery.admin",
        "roles/datastore.admin",
        "roles/pubsub.admin",
        "roles/cloudtasks.admin",
        "roles/secretmanager.secretAccessor",
        "roles/monitoring.metricWriter",
        "roles/logging.logWriter"
      ]
    }
    deployer = {
      display_name = "Shopify MCP Deployer"
      roles = [
        "roles/cloudbuild.builds.editor",
        "roles/container.developer",
        "roles/storage.objectCreator"
      ]
    }
    function = {
      display_name = "Shopify MCP Cloud Function"
      roles = [
        "roles/cloudfunctions.invoker",
        "roles/datastore.user",
        "roles/pubsub.publisher",
        "roles/secretmanager.secretAccessor"
      ]
    }
  }
}

# Firestore
resource "google_firestore_database" "main" {
  project                     = var.project_id
  name                        = "shopify-mcp-db"
  location_id                = var.region
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode           = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [google_project_service.apis["firestore.googleapis.com"]]
}

# BigQuery
module "bigquery" {
  source = "./modules/bigquery"
  
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  
  datasets = {
    shopify_data = {
      location    = var.region
      description = "Shopify data warehouse"
      tables = {
        products = {
          schema = file("schemas/products.json")
          time_partitioning = {
            type  = "DAY"
            field = "created_at"
          }
        }
        orders = {
          schema = file("schemas/orders.json")
          time_partitioning = {
            type  = "DAY"
            field = "created_at"
          }
        }
        customers = {
          schema = file("schemas/customers.json")
          time_partitioning = {
            type  = "DAY"
            field = "created_at"
          }
        }
      }
    }
    analytics = {
      location    = var.region
      description = "Analytics and reporting data"
      tables = {
        metrics = {
          schema = file("schemas/metrics.json")
          time_partitioning = {
            type  = "DAY"
            field = "timestamp"
          }
        }
        events = {
          schema = file("schemas/events.json")
          time_partitioning = {
            type  = "DAY"
            field = "timestamp"
          }
        }
      }
    }
  }
}

# Cloud Storage
module "storage" {
  source = "./modules/storage"
  
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  
  buckets = {
    data = {
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true
      lifecycle_rules = []
    }
    backups = {
      location      = var.region
      storage_class = "NEARLINE"
      versioning    = true
      lifecycle_rules = [
        {
          action = "Delete"
          condition = {
            age = 90
          }
        }
      ]
    }
    exports = {
      location      = var.region
      storage_class = "STANDARD"
      versioning    = false
      lifecycle_rules = [
        {
          action = "SetStorageClass"
          storage_class = "NEARLINE"
          condition = {
            age = 30
          }
        },
        {
          action = "Delete"
          condition = {
            age = 365
          }
        }
      ]
    }
    temp = {
      location      = var.region
      storage_class = "STANDARD"
      versioning    = false
      lifecycle_rules = [
        {
          action = "Delete"
          condition = {
            age = 7
          }
        }
      ]
    }
  }
}

# Pub/Sub Topics
module "pubsub" {
  source = "./modules/pubsub"
  
  project_id = var.project_id
  
  topics = {
    shopify-events = {
      message_retention = "604800s" # 7 days
      subscriptions = {
        analytics = {
          ack_deadline = 600
          retain_acked = false
          expiration_policy = "2592000s" # 30 days
        }
        export = {
          ack_deadline = 600
          retain_acked = false
          expiration_policy = "2592000s"
        }
      }
    }
    analytics-events = {
      message_retention = "604800s"
      subscriptions = {
        monitoring = {
          ack_deadline = 60
          retain_acked = false
          expiration_policy = "2592000s"
        }
      }
    }
    system-events = {
      message_retention = "86400s" # 1 day
      subscriptions = {
        logging = {
          ack_deadline = 60
          retain_acked = false
          expiration_policy = "2592000s"
        }
      }
    }
  }
}

# Cloud Tasks
resource "google_cloud_tasks_queue" "export_queue" {
  name     = "export-queue"
  location = var.region
  
  rate_limits {
    max_dispatches_per_second = 10
    max_concurrent_dispatches = 1000
  }
  
  retry_config {
    max_attempts       = 5
    max_retry_duration = "3600s"
    min_backoff        = "10s"
    max_backoff        = "600s"
    max_doublings      = 16
  }
  
  depends_on = [google_project_service.apis["cloudtasks.googleapis.com"]]
}

# Memory Store (Redis)
resource "google_redis_instance" "cache" {
  name               = "shopify-mcp-cache"
  tier               = "STANDARD_HA"
  memory_size_gb     = 5
  region            = var.region
  redis_version     = "REDIS_6_X"
  display_name      = "Shopify MCP Cache"
  authorized_network = module.vpc.network_self_link
  
  lifecycle {
    prevent_destroy = true
  }
  
  depends_on = [google_project_service.apis["redis.googleapis.com"]]
}

# Cloud Run Services
module "cloud_run" {
  source = "./modules/cloud_run"
  
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  
  services = {
    auth = {
      image = "gcr.io/${var.project_id}/auth-service:latest"
      cpu_limit = "2"
      memory_limit = "2Gi"
      min_instances = 1
      max_instances = 10
      port = 3001
      service_account = module.service_accounts.service_accounts["runtime"].email
    }
    shopify = {
      image = "gcr.io/${var.project_id}/shopify-service:latest"
      cpu_limit = "4"
      memory_limit = "4Gi"
      min_instances = 2
      max_instances = 20
      port = 3002
      service_account = module.service_accounts.service_accounts["runtime"].email
    }
    analytics = {
      image = "gcr.io/${var.project_id}/analytics-service:latest"
      cpu_limit = "4"
      memory_limit = "8Gi"
      min_instances = 1
      max_instances = 10
      port = 3006
      service_account = module.service_accounts.service_accounts["runtime"].email
    }
    export = {
      image = "gcr.io/${var.project_id}/export-service:latest"
      cpu_limit = "2"
      memory_limit = "4Gi"
      min_instances = 0
      max_instances = 5
      port = 3007
      service_account = module.service_accounts.service_accounts["runtime"].email
    }
  }
}

# Load Balancer
module "load_balancer" {
  source = "./modules/load_balancer"
  
  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  vpc_network  = module.vpc.network_self_link
  
  backend_services = {
    auth-service = {
      port_name   = "http"
      protocol    = "HTTP"
      timeout_sec = 30
      health_check = {
        check_interval_sec = 10
        timeout_sec        = 5
        path              = "/health"
      }
      backends = [
        {
          group = module.cloud_run.neg_ids["auth"]
        }
      ]
    }
    shopify-service = {
      port_name   = "http"
      protocol    = "HTTP"
      timeout_sec = 60
      health_check = {
        check_interval_sec = 10
        timeout_sec        = 5
        path              = "/health"
      }
      backends = [
        {
          group = module.cloud_run.neg_ids["shopify"]
        }
      ]
    }
  }
  
  url_map_rules = [
    {
      hosts        = ["api.shopify-mcp.com"]
      path_matcher = "api"
      paths = [
        {
          paths = ["/auth", "/auth/*"]
          service = "auth-service"
        },
        {
          paths = ["/shopify", "/shopify/*"]
          service = "shopify-service"
        },
        {
          paths = ["/analytics", "/analytics/*"]
          service = "analytics-service"
        },
        {
          paths = ["/export", "/export/*"]
          service = "export-service"
        }
      ]
    }
  ]
}

# Monitoring and Alerting
module "monitoring" {
  source = "./modules/monitoring"
  
  project_id  = var.project_id
  environment = var.environment
  
  notification_channels = [
    {
      type   = "email"
      labels = {
        email_address = "alerts@shopify-mcp.com"
      }
    }
  ]
  
  alert_policies = {
    high_error_rate = {
      display_name = "High Error Rate"
      conditions = [{
        display_name = "Error rate above 5%"
        metric_filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\""
        threshold_value = 0.05
        duration = "300s"
      }]
    }
    high_latency = {
      display_name = "High Latency"
      conditions = [{
        display_name = "Latency above 1000ms"
        metric_filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
        threshold_value = 1000
        duration = "300s"
      }]
    }
  }
  
  uptime_checks = {
    api_health = {
      display_name = "API Health Check"
      monitored_resource = {
        type = "uptime_url"
        labels = {
          host = "api.shopify-mcp.com"
          project_id = var.project_id
        }
      }
      http_check = {
        path = "/health"
        port = 443
        use_ssl = true
      }
      period = "60s"
      timeout = "10s"
    }
  }
}

# Cloud Scheduler
resource "google_cloud_scheduler_job" "daily_sync" {
  name        = "daily-sync"
  description = "Daily synchronization of Shopify data"
  schedule    = "0 2 * * *" # 2 AM daily
  time_zone   = "Asia/Tokyo"
  region      = var.region
  
  pubsub_target {
    topic_name = module.pubsub.topic_ids["system-events"]
    data = base64encode(jsonencode({
      event = "daily_sync"
      timestamp = timestamp()
    }))
  }
  
  depends_on = [google_project_service.apis["cloudscheduler.googleapis.com"]]
}

# Outputs
output "cluster_endpoint" {
  value       = module.gke.cluster_endpoint
  description = "GKE cluster endpoint"
}

output "load_balancer_ip" {
  value       = module.load_balancer.external_ip
  description = "Load balancer external IP"
}

output "redis_host" {
  value       = google_redis_instance.cache.host
  description = "Redis instance host"
}

output "service_urls" {
  value       = module.cloud_run.service_urls
  description = "Cloud Run service URLs"
}

output "bucket_names" {
  value       = module.storage.bucket_names
  description = "Storage bucket names"
}