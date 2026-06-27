# =============================================================================
# AUSTA Care Platform — Production Environment Outputs
# =============================================================================

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------
output "vpc_id" {
  description = "ID of the provisioned VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = module.vpc.database_subnet_ids
}

output "nat_gateway_ips" {
  description = "Public IPs of the NAT Gateways"
  value       = module.vpc.nat_gateway_ips
}

# ---------------------------------------------------------------------------
# EKS
# ---------------------------------------------------------------------------
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for the EKS cluster"
  value       = module.eks.cluster_oidc_issuer_url
}

output "eks_node_security_group_id" {
  description = "Security group ID for EKS worker nodes"
  value       = module.eks.node_security_group_id
}

# ---------------------------------------------------------------------------
# RDS
# ---------------------------------------------------------------------------
output "rds_endpoint" {
  description = "RDS primary endpoint (writer)"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS reader endpoint"
  value       = module.rds.reader_endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "Name of the default database"
  value       = module.rds.database_name
}

# ---------------------------------------------------------------------------
# ElastiCache
# ---------------------------------------------------------------------------
output "redis_primary_endpoint" {
  description = "Redis replication group primary endpoint"
  value       = module.elasticache.primary_endpoint
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Redis replication group reader endpoint"
  value       = module.elasticache.reader_endpoint
  sensitive   = true
}

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------
output "datalake_bucket_name" {
  description = "Data lake S3 bucket name"
  value       = module.s3.datalake_bucket_name
}

output "backups_bucket_name" {
  description = "Backups S3 bucket name"
  value       = module.s3.backups_bucket_name
}

output "artifacts_bucket_name" {
  description = "Artifacts S3 bucket name"
  value       = module.s3.artifacts_bucket_name
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = module.iam.eks_cluster_role_arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = module.iam.eks_node_role_arn
}
