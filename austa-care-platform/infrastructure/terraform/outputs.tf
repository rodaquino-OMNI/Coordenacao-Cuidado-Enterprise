# =============================================================================
# AUSTA Care Platform — Root Outputs
# =============================================================================
# Root-level outputs (available after terraform plan/apply).
# Module-specific outputs are surfaced in environment output files.
# =============================================================================

output "aws_region" {
  description = "Deployment AWS region"
  value       = var.aws_region
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "aws_account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_caller_arn" {
  description = "AWS caller ARN"
  value       = data.aws_caller_identity.current.arn
}

output "available_availability_zones" {
  description = "Availability zones available in the region"
  value       = data.aws_availability_zones.available.names
}
