# =============================================================================
# ElastiCache Module — AUSTA Care Platform
# =============================================================================
# Redis replication group with Multi-AZ, automatic failover, encryption at rest
# and in transit, and CloudWatch monitoring.
# =============================================================================

# ---------------------------------------------------------------------------
# ElastiCache Subnet Group (externally managed — passed in)
# ---------------------------------------------------------------------------
data "aws_elasticache_subnet_group" "selected" {
  name = var.subnet_group_name
}

# ---------------------------------------------------------------------------
# Redis Parameter Group
# ---------------------------------------------------------------------------
resource "aws_elasticache_parameter_group" "redis7" {
  name        = "${var.project_name}-${var.environment}-redis7"
  family      = "redis7"
  description = "Parameter group for ${var.project_name} ${var.environment} Redis 7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Redis Security Group
# ---------------------------------------------------------------------------
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from application tier"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-redis-sg"
    }
  )
}

# ---------------------------------------------------------------------------
# Redis Replication Group
# ---------------------------------------------------------------------------
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-${var.environment}"

  description = "Redis cluster for ${var.project_name} ${var.environment}"

  engine         = "redis"
  engine_version = var.engine_version
  node_type      = var.node_type

  num_cache_clusters        = var.num_cache_clusters
  automatic_failover_enabled = var.automatic_failover

  subnet_group_name  = data.aws_elasticache_subnet_group.selected.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption (at rest + in transit)
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = var.auth_token

  # Parameter group
  parameter_group_name = aws_elasticache_parameter_group.redis7.name

  # Maintenance
  maintenance_window          = "sun:05:00-sun:06:00"
  snapshot_window             = "02:00-03:00"
  snapshot_retention_limit    = var.snapshot_retention_limit
  auto_minor_version_upgrade  = true

  # Multi-AZ placement
  multi_az_enabled = var.automatic_failover

  port = 6379

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-redis"
    }
  )
}
