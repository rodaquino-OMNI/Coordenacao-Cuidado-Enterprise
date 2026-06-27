# =============================================================================
# AUSTA Care Platform — Version Constraints
# =============================================================================
# Terraform and provider version requirements.
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

  # ---------------------------------------------------------------------------
  # Remote state (S3 + DynamoDB lock)
  # Create the S3 bucket and DynamoDB table manually first, then uncomment
  # this block and run 'terraform init -reconfigure'
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "austa-care-tfstate-prod"
  #   key            = "austa-care-platform/terraform.tfstate"
  #   region         = "sa-east-1"
  #   encrypt        = true
  #   dynamodb_table = "austa-care-tfstate-locks"
  # }
}
