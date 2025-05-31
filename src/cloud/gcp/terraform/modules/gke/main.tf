# GKE Cluster
resource "google_container_cluster" "primary" {
  name               = var.cluster_name
  location           = var.region
  node_locations     = var.zones
  initial_node_count = 1
  
  network    = var.vpc_network
  subnetwork = var.vpc_subnetwork
  
  networking_mode = "VPC_NATIVE"
  
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
  
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
  
  cluster_autoscaling {
    enabled = true
    
    resource_limits {
      resource_type = "cpu"
      minimum       = 10
      maximum       = 100
    }
    
    resource_limits {
      resource_type = "memory"
      minimum       = 40
      maximum       = 400
    }
    
    auto_provisioning_defaults {
      service_account = google_service_account.nodes.email
      oauth_scopes = [
        "https://www.googleapis.com/auth/cloud-platform"
      ]
    }
  }
  
  addons_config {
    horizontal_pod_autoscaling {
      disabled = false
    }
    
    http_load_balancing {
      disabled = false
    }
    
    network_policy_config {
      disabled = false
    }
    
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }
  
  network_policy {
    enabled  = true
    provider = "CALICO"
  }
  
  release_channel {
    channel = "RAPID"
  }
  
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
  
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T09:00:00Z"
      end_time   = "2023-01-01T17:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }
  
  remove_default_node_pool = true
  
  resource_labels = {
    environment = var.environment
    project     = "shopify-mcp"
  }
}

# Service Account for Nodes
resource "google_service_account" "nodes" {
  account_id   = "${var.cluster_name}-nodes"
  display_name = "GKE Nodes Service Account"
}

resource "google_project_iam_member" "nodes_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.nodes.email}"
}

# Node Pools
resource "google_container_node_pool" "node_pools" {
  for_each = var.node_pools
  
  name       = each.key
  location   = var.region
  cluster    = google_container_cluster.primary.name
  
  node_config {
    preemptible     = each.value.preemptible
    machine_type    = each.value.machine_type
    disk_size_gb    = each.value.disk_size_gb
    disk_type       = "pd-standard"
    service_account = google_service_account.nodes.email
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
    
    labels = {
      environment = var.environment
      node_pool   = each.key
    }
    
    tags = ["gke-node", var.cluster_name]
  }
  
  autoscaling {
    min_node_count = each.value.min_nodes
    max_node_count = each.value.max_nodes
  }
  
  management {
    auto_repair  = true
    auto_upgrade = true
  }
  
  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "zones" {
  description = "GCP Zones"
  type        = list(string)
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "vpc_network" {
  description = "VPC network self link"
  type        = string
}

variable "vpc_subnetwork" {
  description = "VPC subnetwork self link"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "node_pools" {
  description = "Node pool configurations"
  type = map(object({
    machine_type = string
    min_nodes    = number
    max_nodes    = number
    disk_size_gb = number
    preemptible  = bool
  }))
}

# Outputs
output "cluster_endpoint" {
  value       = google_container_cluster.primary.endpoint
  description = "GKE cluster endpoint"
}

output "cluster_ca_certificate" {
  value       = google_container_cluster.primary.master_auth.0.cluster_ca_certificate
  description = "Cluster CA certificate"
  sensitive   = true
}

output "cluster_name" {
  value       = google_container_cluster.primary.name
  description = "GKE cluster name"
}