# =============================================================================
# ElastiCache Module — Outputs
# =============================================================================

output "primary_endpoint" {
  description = "Redis replication group primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Redis replication group reader endpoint"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "replication_group_id" {
  description = "Replication group identifier"
  value       = aws_elasticache_replication_group.redis.replication_group_id
}

output "security_group_id" {
  description = "Security group ID for Redis"
  value       = aws_security_group.redis.id
}
