# =============================================================================
# AUSTA Care Platform — Terraform Root Configuration
# =============================================================================
# Provider: AWS sa-east-1 (São Paulo)
# Version constraints live in versions.tf
# =============================================================================

# ---------------------------------------------------------------------------
# Remote state (S3 + DynamoDB lock)
# Create the S3 bucket and DynamoDB table manually first, then uncomment
# the backend block in versions.tf and run 'terraform init -reconfigure'
# ---------------------------------------------------------------------------

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
