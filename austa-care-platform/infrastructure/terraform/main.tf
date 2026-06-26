# =============================================================================
# AUSTA Care Platform — Terraform Root Configuration
# =============================================================================
# Provider: AWS sa-east-1 (São Paulo)
# Remote State: S3 + DynamoDB lock (placeholder — do not apply yet)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote state — create the S3 bucket and DynamoDB table manually first, then
  # uncomment this block and run 'terraform init -reconfigure'
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "austa-care-tfstate-prod"
  #   key            = "austa-care-platform/terraform.tfstate"
  #   region         = "sa-east-1"
  #   encrypt        = true
  #   dynamodb_table = "austa-care-tfstate-locks"
  # }
}

# =============================================================================
# Provider
# =============================================================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# =============================================================================
# Common Locals
# =============================================================================
locals {
  common_tags = {
    Environment        = var.environment
    Project            = "AustaCare"
    Compliance         = "LGPD"
    DataClassification = "PHI"
    ManagedBy          = "Terraform"
    Owner              = "DevOps Team"
  }
}

# =============================================================================
# Data Sources
# =============================================================================
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
