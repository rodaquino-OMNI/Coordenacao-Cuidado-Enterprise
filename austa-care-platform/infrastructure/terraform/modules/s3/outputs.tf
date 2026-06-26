# =============================================================================
# S3 Module — Outputs
# =============================================================================

output "datalake_bucket_name" {
  description = "Data lake S3 bucket name"
  value       = aws_s3_bucket.datalake.id
}

output "datalake_bucket_arn" {
  description = "Data lake S3 bucket ARN"
  value       = aws_s3_bucket.datalake.arn
}

output "backups_bucket_name" {
  description = "Backups S3 bucket name"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups S3 bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

output "artifacts_bucket_name" {
  description = "Artifacts S3 bucket name"
  value       = aws_s3_bucket.artifacts.id
}

output "artifacts_bucket_arn" {
  description = "Artifacts S3 bucket ARN"
  value       = aws_s3_bucket.artifacts.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for S3 encryption"
  value       = aws_kms_key.s3.arn
}
