# =============================================================================
# AUSTA Care Platform — Staging Environment
# =============================================================================
# Instantiates all platform modules with staging-grade (smaller) values.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.25"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

locals {
  environment  = "staging"
  project_name = "austa-care"

  common_tags = {
    Environment        = local.environment
    Project            = "AustaCare"
    Compliance         = "LGPD"
    DataClassification = "PHI"
    ManagedBy          = "Terraform"
  }
}

# =============================================================================
# VPC
# =============================================================================
module "vpc" {
  source = "../../modules/vpc"

  aws_region            = var.aws_region
  project_name          = local.project_name
  environment           = local.environment
  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  enable_nat_gateway    = true # Single NAT for staging to reduce cost
  enable_vpc_endpoints  = true

  tags = local.common_tags
}

# =============================================================================
# EKS
# =============================================================================
module "eks" {
  source = "../../modules/eks"

  project_name           = local.project_name
  environment            = local.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  cluster_version        = var.eks_cluster_version
  enable_public_endpoint = false
  node_groups            = var.eks_node_groups

  tags = local.common_tags
}

# =============================================================================
# RDS
# =============================================================================
module "rds" {
  source = "../../modules/rds"

  project_name               = local.project_name
  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  db_subnet_group_name       = module.vpc.database_subnet_group_name
  allowed_security_group_ids = [module.eks.node_security_group_id]

  engine                = "postgres"
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = 200
  database_name         = "austacare"
  username              = var.rds_username
  password              = var.rds_password

  multi_az                       = false # Staging single-AZ for cost savings
  backup_retention_period        = var.rds_backup_retention
  deletion_protection            = false
  enable_performance_insights    = true
  performance_insights_retention = 7

  tags = local.common_tags
}

# =============================================================================
# ElastiCache (Redis)
# =============================================================================
module "elasticache" {
  source = "../../modules/elasticache"

  project_name               = local.project_name
  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  subnet_group_name          = module.vpc.elasticache_subnet_group_name
  allowed_security_group_ids = [module.eks.node_security_group_id]

  engine_version           = var.redis_engine_version
  node_type                = var.redis_node_type
  num_cache_clusters       = 1 # Staging: single node
  automatic_failover       = false
  snapshot_retention_limit = 2
  auth_token               = var.redis_auth_token

  tags = local.common_tags
}

# =============================================================================
# S3
# =============================================================================
module "s3" {
  source = "../../modules/s3"

  project_name = local.project_name
  environment  = local.environment

  tags = local.common_tags
}

# =============================================================================
# IAM
# =============================================================================
module "iam" {
  source = "../../modules/iam"

  project_name = local.project_name
  environment  = local.environment
  aws_region   = var.aws_region

  tags = local.common_tags
}
