# VPC Network
resource "google_compute_network" "vpc" {
  name                    = var.vpc_name
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
  project                = var.project_id
}

# Subnetwork
resource "google_compute_subnetwork" "subnet" {
  name          = "${var.vpc_name}-subnet-${var.region}"
  ip_cidr_range = var.subnet_cidr
  network       = google_compute_network.vpc.self_link
  region        = var.region
  
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = cidrsubnet(var.subnet_cidr, 4, 1)
  }
  
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = cidrsubnet(var.subnet_cidr, 4, 2)
  }
  
  private_ip_google_access = true
  
  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling       = 0.5
    metadata           = "INCLUDE_ALL_METADATA"
  }
}

# NAT Gateway
resource "google_compute_router" "router" {
  name    = "${var.vpc_name}-router"
  network = google_compute_network.vpc.self_link
  region  = var.region
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.vpc_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.vpc_name}-allow-internal"
  network = google_compute_network.vpc.self_link
  
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "icmp"
  }
  
  source_ranges = [var.subnet_cidr]
  priority      = 1000
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.vpc_name}-allow-health-checks"
  network = google_compute_network.vpc.self_link
  
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["http-server", "https-server"]
  priority      = 1100
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.vpc_name}-allow-ssh"
  network = google_compute_network.vpc.self_link
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh-enabled"]
  priority      = 1200
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.vpc_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.self_link
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "vpc_name" {
  description = "VPC Network name"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "subnet_cidr" {
  description = "Subnet CIDR range"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

# Outputs
output "network_self_link" {
  value       = google_compute_network.vpc.self_link
  description = "VPC network self link"
}

output "subnetwork_self_link" {
  value       = google_compute_subnetwork.subnet.self_link
  description = "Subnetwork self link"
}

output "router_name" {
  value       = google_compute_router.router.name
  description = "Router name"
}