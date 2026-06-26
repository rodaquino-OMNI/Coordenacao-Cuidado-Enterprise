# =============================================================================
# RDS Module — Variables
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

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  type        = string
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect to RDS"
  type        = list(string)
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
variable "engine" {
  description = "Database engine"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.6"
}

variable "instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage with autoscaling (GB)"
  type        = number
  default     = 500
}

variable "database_name" {
  description = "Name of the default database"
  type        = string
  default     = "austacare"
}

variable "username" {
  description = "Master username (use Secrets Manager in production!)"
  type        = string
  default     = "austacare_admin"
  sensitive   = true
}

variable "password" {
  description = "Master password (use Secrets Manager in production!)"
  type        = string
  sensitive   = true
}

# ---------------------------------------------------------------------------
# High Availability & Backup
# ---------------------------------------------------------------------------
variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Backup retention in days"
  type        = number
  default     = 30
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# Monitoring
# ---------------------------------------------------------------------------
variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention" {
  description = "Performance Insights retention period (days)"
  type        = number
  default     = 7
}

# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------
variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
