# =============================================================================
# RDS Module — AUSTA Care Platform
# =============================================================================
# Amazon RDS PostgreSQL 15 with encryption at rest, Multi-AZ, automated
# backups, deletion protection, and Performance Insights.
# =============================================================================

# ---------------------------------------------------------------------------
# DB Subnet Group (externally managed — passed in)
# ---------------------------------------------------------------------------
data "aws_db_subnet_group" "selected" {
  name = var.db_subnet_group_name
}

# ---------------------------------------------------------------------------
# KMS Key for RDS Encryption
# ---------------------------------------------------------------------------
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS ${var.project_name}-${var.environment} encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ---------------------------------------------------------------------------
# RDS Security Group
# ---------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-rds-sg"
    }
  )
}

# ---------------------------------------------------------------------------
# RDS Parameter Group (PostgreSQL 15)
# ---------------------------------------------------------------------------
resource "aws_db_parameter_group" "postgres15" {
  name        = "${var.project_name}-${var.environment}-pg15"
  family      = "postgres15"
  description = "Parameter group for ${var.project_name} ${var.environment} PostgreSQL 15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # 1 second — adjust for production needs
  }

  parameter {
    name  = "ssl"
    value = "1"
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# RDS Instance
# ---------------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}"

  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = var.database_name
  username = var.username
  password = var.password

  port = 5432

  # High availability
  multi_az = var.multi_az

  # Network
  db_subnet_group_name   = data.aws_db_subnet_group.selected.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Backup
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  copy_tags_to_snapshot = true
  skip_final_snapshot   = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-snapshot"

  # Protection
  deletion_protection = var.deletion_protection

  # Monitoring
  monitoring_interval = var.enable_performance_insights ? 60 : 0
  monitoring_role_arn = var.enable_performance_insights ? aws_iam_role.rds_monitoring[0].arn : null

  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.performance_insights_retention
  performance_insights_kms_key_id       = aws_kms_key.rds.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  auto_minor_version_upgrade = true

  parameter_group_name = aws_db_parameter_group.postgres15.name

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-rds"
    }
  )
}

# ---------------------------------------------------------------------------
# IAM Role for Enhanced Monitoring
# ---------------------------------------------------------------------------
resource "aws_iam_role" "rds_monitoring" {
  count = var.enable_performance_insights ? 1 : 0

  name = "${var.project_name}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.enable_performance_insights ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_monitoring[0].name
}
