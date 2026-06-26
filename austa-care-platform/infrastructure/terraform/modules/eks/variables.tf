# =============================================================================
# EKS Module — Variables
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
  description = "VPC ID where the cluster will be placed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EKS node groups"
  type        = list(string)
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "enable_public_endpoint" {
  description = "Enable public access to the EKS API server endpoint"
  type        = bool
  default     = false
}

variable "node_groups" {
  description = "EKS managed node group definitions"
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size      = number
    capacity_type  = optional(string, "ON_DEMAND")
  }))
  default = {}
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
