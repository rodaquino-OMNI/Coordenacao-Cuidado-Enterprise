# =============================================================================
# RDS Module — Outputs
# =============================================================================

output "endpoint" {
  description = "RDS instance endpoint (writer)"
  value       = aws_db_instance.main.endpoint
}

output "reader_endpoint" {
  description = "RDS reader endpoint (empty if not applicable)"
  value       = ""
}

output "database_name" {
  description = "Default database name"
  value       = aws_db_instance.main.db_name
}

output "instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "security_group_id" {
  description = "Security group ID for RDS"
  value       = aws_security_group.rds.id
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for RDS encryption"
  value       = aws_kms_key.rds.arn
}
