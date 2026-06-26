# =============================================================================
# S3 Module — Variables
# =============================================================================

variable "project_name" {
  description = "Project / platform identifier"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
