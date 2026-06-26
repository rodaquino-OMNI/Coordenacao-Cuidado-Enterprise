# =============================================================================
# IAM Module — AUSTA Care Platform
# =============================================================================
# IAM roles, policies, and instance profiles for the AUSTA Care Platform.
# Includes roles for EKS IRSA, RDS access, Secrets Manager, and backup
# automation.
# =============================================================================

# ---------------------------------------------------------------------------
# EKS Cluster Role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "eks_cluster" {
  name = "${var.project_name}-${var.environment}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# ---------------------------------------------------------------------------
# EKS Node Role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "eks_node" {
  name = "${var.project_name}-${var.environment}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "eks_worker_node" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "eks_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "ecr_readonly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.eks_node.name
}

# ---------------------------------------------------------------------------
# Secrets Manager Access Policy (for EKS pods via IRSA)
# ---------------------------------------------------------------------------
resource "aws_iam_policy" "secrets_manager_read" {
  name        = "${var.project_name}-${var.environment}-secrets-read"
  description = "Read-only access to AUSTA Care secrets in Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = [
        "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}-${var.environment}/*"
      ]
    }]
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# RDS Access Policy (for backup jobs and monitoring)
# ---------------------------------------------------------------------------
resource "aws_iam_policy" "rds_backup" {
  name        = "${var.project_name}-${var.environment}-rds-backup"
  description = "Policy for automated RDS snapshot management"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:CreateDBSnapshot",
          "rds:DeleteDBSnapshot",
          "rds:DescribeDBSnapshots",
          "rds:CopyDBSnapshot"
        ]
        Resource = [
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:snapshot:*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:${var.project_name}-${var.environment}*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.project_name}-${var.environment}-backups-${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# S3 Data Lake Access Policy (for analytics / ETL)
# ---------------------------------------------------------------------------
resource "aws_iam_policy" "datalake_access" {
  name        = "${var.project_name}-${var.environment}-datalake-access"
  description = "Read/write access to the data lake S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-${var.environment}-datalake-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::${var.project_name}-${var.environment}-datalake-${data.aws_caller_identity.current.account_id}/*"
        ]
      }
    ]
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# IAM Role for Backup Automation (AWS Backup service)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "backup" {
  name = "${var.project_name}-${var.environment}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "backup.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "backup_service" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
  role       = aws_iam_role.backup.name
}

# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------
data "aws_caller_identity" "current" {}
