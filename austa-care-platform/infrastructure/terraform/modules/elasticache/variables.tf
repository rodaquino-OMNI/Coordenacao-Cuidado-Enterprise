# =============================================================================
# ElastiCache Module — Variables
# =============================================================================

variable "project_name" {
  description = "Project / platform identifier"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_group_name" {
  description = "Name of the ElastiCache subnet group"
  type        = string
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect to Redis"
  type        = list(string)
}

# ---------------------------------------------------------------------------
# Redis Configuration
# ---------------------------------------------------------------------------
variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters in the replication group"
  type        = number
  default     = 3
}

variable "automatic_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

variable "auth_token" {
  description = "Redis AUTH token (transit encryption password)"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
