# =============================================================================
# AUSTA Care Platform — Global Variables
# =============================================================================

# ---------------------------------------------------------------------------
# General
# ---------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "sa-east-1"
}

variable "environment" {
  description = "Deployment environment (production, staging)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "Environment must be 'production' or 'staging'."
  }
}

variable "project_name" {
  description = "Project / platform identifier"
  type        = string
  default     = "austa-care"
}

# ---------------------------------------------------------------------------
# VPC / Networking
# ---------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["sa-east-1a", "sa-east-1b", "sa-east-1c"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

# ---------------------------------------------------------------------------
# EKS
# ---------------------------------------------------------------------------
variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.28"
}

variable "eks_node_groups" {
  description = "EKS managed node group definitions"
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size      = number
    capacity_type  = optional(string, "ON_DEMAND")
  }))
  default = {
    general = {
      instance_types = ["m5.xlarge", "m5a.xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 3
      disk_size      = 100
    }
    spot = {
      instance_types = ["m5.large", "m5a.large", "m5n.large"]
      min_size       = 0
      max_size       = 20
      desired_size   = 2
      disk_size      = 50
      capacity_type  = "SPOT"
    }
  }
}

# ---------------------------------------------------------------------------
# RDS
# ---------------------------------------------------------------------------
variable "rds_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "rds_engine" {
  description = "RDS database engine"
  type        = string
  default     = "postgres"
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.6"
}

variable "rds_backup_retention" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "rds_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# ElastiCache (Redis)
# ---------------------------------------------------------------------------
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the replication group"
  type        = number
  default     = 3
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover for Redis replication group"
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# Domain
# ---------------------------------------------------------------------------
variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "austa.com.br"
}

variable "subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}
