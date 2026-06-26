# =============================================================================
# IAM Module — Outputs
# =============================================================================

output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_cluster_role_name" {
  description = "Name of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.name
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = aws_iam_role.eks_node.arn
}

output "eks_node_role_name" {
  description = "Name of the EKS node IAM role"
  value       = aws_iam_role.eks_node.name
}

output "secrets_manager_policy_arn" {
  description = "ARN of the Secrets Manager read-only policy"
  value       = aws_iam_policy.secrets_manager_read.arn
}

output "datalake_access_policy_arn" {
  description = "ARN of the data lake access policy"
  value       = aws_iam_policy.datalake_access.arn
}

output "backup_role_arn" {
  description = "ARN of the backup automation role"
  value       = aws_iam_role.backup.arn
}
