#!/bin/bash
set -euo pipefail

# ============================================================
# AUSTA Care Platform - Staging Deployment Script
# ============================================================
# Deploy Kubernetes manifests to the austa-staging namespace.
# This script assumes:
#   - kubectl is configured and pointing to the staging EKS cluster
#   - The current working directory is the repository root
#   - All dependent infrastructure (RDS, Redis, Kafka, etc.) is provisioned
#
# Usage:
#   ./infrastructure/scripts/deploy-staging.sh
#   NAMESPACE=austa-staging ./infrastructure/scripts/deploy-staging.sh  # override
# ============================================================

# ---- Configuration ----
NAMESPACE="${NAMESPACE:-austa-staging}"
K8S_DIR="${K8S_DIR:-k8s}"
TIMEOUT="${TIMEOUT:-300s}"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPTS_DIR/../.." && pwd)"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---- Helper Functions ----
log()   { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

banner() {
  echo ""
  echo "============================================"
  echo "  AUSTA Care Platform - Staging Deploy"
  echo "  Namespace: ${NAMESPACE}"
  echo "  Time:      $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================"
  echo ""
}

# Apply a YAML file and check for errors
apply_file() {
  local file="$1"
  log "Applying: ${file}"
  kubectl apply -f "${file}" -n "${NAMESPACE}" || err "Failed to apply: ${file}"
  ok "Applied:  ${file}"
}

# Apply all YAML files in a directory
apply_dir() {
  local dir="$1"
  if [ -d "${dir}" ]; then
    log "Applying all manifests in: ${dir}"
    kubectl apply -f "${dir}" -n "${NAMESPACE}" || err "Failed to apply directory: ${dir}"
    ok "Applied:  ${dir}"
  else
    warn "Directory not found, skipping: ${dir}"
  fi
}

# Wait for a deployment rollout
wait_for_deployment() {
  local deployment="$1"
  log "Waiting for deployment/${deployment} to be ready..."
  kubectl rollout status "deployment/${deployment}" \
    -n "${NAMESPACE}" \
    --timeout="${TIMEOUT}" \
    || err "Deployment ${deployment} failed to become ready within ${TIMEOUT}"
  ok "Deployment ${deployment} is ready"
}

# ---- Prerequisites Check ----
check_prerequisites() {
  log "Checking prerequisites..."

  if ! command -v kubectl &> /dev/null; then
    err "kubectl not found. Please install kubectl: https://kubernetes.io/docs/tasks/tools/"
  fi

  # Check cluster connectivity
  if ! kubectl cluster-info &> /dev/null; then
    err "Cannot connect to Kubernetes cluster. Check your kubeconfig."
  fi

  # Verify the namespace exists
  if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    warn "Namespace '${NAMESPACE}' does not exist. Creating..."
    kubectl create namespace "${NAMESPACE}"
    ok "Namespace '${NAMESPACE}' created"
  fi

  ok "All prerequisites met"
}

# ---- Deployment Order ----
deploy_all() {
  cd "${PROJECT_ROOT}"

  # 1. Namespace (idempotent)
  if [ -f "${K8S_DIR}/namespace.yaml" ]; then
    log "Ensuring namespaces exist..."
    kubectl apply -f "${K8S_DIR}/namespace.yaml"
    ok "Namespaces applied"
  fi

  # 2. ConfigMaps and Secrets (non-sensitive config)
  apply_dir "${K8S_DIR}/configmaps/"

  # 3. PersistentVolumeClaims (must exist before deployments referencing them)
  apply_dir "${K8S_DIR}/pvc/"

  # 4. Services (ClusterIP endpoints)
  apply_dir "${K8S_DIR}/services/"

  # 5. Deployments
  apply_dir "${K8S_DIR}/deployments/"

  # 6. Ingress (external routing)
  if [ -f "${K8S_DIR}/ingress.yaml" ]; then
    apply_file "${K8S_DIR}/ingress.yaml"
  fi

  # 7. HorizontalPodAutoscaler
  if [ -f "${K8S_DIR}/hpa.yaml" ]; then
    apply_file "${K8S_DIR}/hpa.yaml"
  fi

  # 8. NetworkPolicy (apply AFTER services are up so traffic isn't blocked mid-deploy)
  if [ -f "${K8S_DIR}/network-policy.yaml" ]; then
    log "Applying NetworkPolicies..."
    kubectl apply -f "${K8S_DIR}/network-policy.yaml"
    ok "NetworkPolicies applied"
  fi

  # 9. ServiceMonitor (for Prometheus Operator)
  if [ -f "${K8S_DIR}/service-monitor.yaml" ]; then
    log "Applying ServiceMonitors..."
    kubectl apply -f "${K8S_DIR}/service-monitor.yaml" || \
      warn "ServiceMonitor apply failed (Prometheus Operator may not be installed yet)"
  fi

  # 10. Wait for backend deployment to be ready
  wait_for_deployment "backend"

  # 11. Wait for frontend deployment to be ready
  wait_for_deployment "frontend"

  echo ""
  log "Deploy complete!"
  echo ""
}

# ---- Post-Deploy Status ----
show_status() {
  echo ""
  echo "============================================"
  echo "  Deployment Status - ${NAMESPACE}"
  echo "============================================"
  echo ""

  log "Pods:"
  kubectl get pods -n "${NAMESPACE}" -o wide 2>/dev/null || warn "No pods found"

  echo ""
  log "Services:"
  kubectl get svc -n "${NAMESPACE}" 2>/dev/null || warn "No services found"

  echo ""
  log "Ingress:"
  kubectl get ingress -n "${NAMESPACE}" 2>/dev/null || warn "No ingress found"

  echo ""
  log "HPA:"
  kubectl get hpa -n "${NAMESPACE}" 2>/dev/null || warn "No HPA found"

  echo ""
  log "NetworkPolicies:"
  kubectl get networkpolicy -n "${NAMESPACE}" 2>/dev/null || warn "No NetworkPolicies found"

  echo ""
  log "PVCs:"
  kubectl get pvc -n "${NAMESPACE}" 2>/dev/null || warn "No PVCs found"

  echo ""
  log "Recent Events (last 5):"
  kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' 2>/dev/null | tail -5 || true

  echo ""
  echo "============================================"
}

# ---- Main ----
main() {
  banner
  check_prerequisites
  deploy_all
  show_status

  ok "Staging deployment completed successfully!"
}

main "$@"
