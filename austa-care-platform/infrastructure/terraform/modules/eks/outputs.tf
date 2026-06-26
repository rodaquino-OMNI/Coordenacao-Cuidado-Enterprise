# =============================================================================
# EKS Module — Outputs
# =============================================================================

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for the cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.cluster.id
}

output "node_security_group_id" {
  description = "Security group ID for EKS worker nodes"
  value       = aws_security_group.node.id
}

output "node_group_names" {
  description = "Names of the EKS managed node groups"
  value       = [for k, v in aws_eks_node_group.main : v.node_group_name]
}

output "oidc_provider_arn" {
  description = "ARN of the OpenID Connect provider"
  value       = aws_iam_openid_connect_provider.cluster.arn
}
