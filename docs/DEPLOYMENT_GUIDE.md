# AUSTA Care Platform - Production Deployment Guide

## Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- Kubernetes cluster (v1.27+) for production
- kubectl configured
- GitHub account with Container Registry access
- Domain name with DNS configured
- SSL certificates (or Let's Encrypt)

## Quick Start - Local Development

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-org/Coordenacao-Cuidado-Enterprise.git
cd Coordenacao-Cuidado-Enterprise/austa-care-platform

# Copy environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 3. Access Services

- Frontend: http://localhost:80
- Backend API: http://localhost:3000
- API Documentation: http://localhost:3000/api-docs
- Grafana: http://localhost:3001 (admin/your_password)
- Prometheus: http://localhost:9090

### 4. Stop Services

```bash
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Production Deployment - Kubernetes

### 1. Prepare Kubernetes Cluster

```bash
# Verify cluster access
kubectl cluster-info

# Create namespace
kubectl apply -f k8s/namespace.yaml
```

### 2. Configure Secrets

```bash
# Create production secrets
kubectl create secret generic austa-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=mongodb-uri="mongodb://..." \
  --from-literal=redis-password="..." \
  --from-literal=jwt-secret="..." \
  --from-literal=aws-access-key-id="..." \
  --from-literal=aws-secret-access-key="..." \
  --from-literal=openai-api-key="..." \
  -n austa-production

# Verify secrets
kubectl get secrets -n austa-production
```

### 3. Configure ConfigMaps

```bash
# Create production config
kubectl create configmap austa-config \
  --from-literal=redis-host="redis.austa-production.svc.cluster.local" \
  --from-literal=kafka-brokers="kafka.austa-production.svc.cluster.local:9092" \
  --from-literal=aws-region="us-east-1" \
  -n austa-production
```

### 4. Deploy Infrastructure

```bash
# Deploy PostgreSQL (if not using managed service)
helm install postgres bitnami/postgresql \
  --namespace austa-production \
  --set auth.postgresPassword=... \
  --set persistence.size=100Gi

# Deploy Redis
helm install redis bitnami/redis \
  --namespace austa-production \
  --set auth.password=... \
  --set master.persistence.size=20Gi

# Deploy MongoDB
helm install mongodb bitnami/mongodb \
  --namespace austa-production \
  --set auth.rootPassword=... \
  --set persistence.size=100Gi

# Deploy Kafka
helm install kafka bitnami/kafka \
  --namespace austa-production \
  --set persistence.size=50Gi
```

### 5. Deploy Application

```bash
# Deploy backend
kubectl apply -f k8s/deployments/backend-deployment.yaml

# Deploy frontend
kubectl apply -f k8s/deployments/frontend-deployment.yaml

# Create services
kubectl apply -f k8s/services/

# Configure ingress
kubectl apply -f k8s/ingress.yaml

# Enable autoscaling
kubectl apply -f k8s/hpa.yaml
```

### 6. Verify Deployment

```bash
# Check pod status
kubectl get pods -n austa-production

# Check deployments
kubectl get deployments -n austa-production

# Check services
kubectl get services -n austa-production

# Check ingress
kubectl get ingress -n austa-production

# View logs
kubectl logs -f deployment/backend -n austa-production
```

### 7. Deploy Monitoring

```bash
# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace austa-production \
  --values monitoring/prometheus-values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  --namespace austa-production \
  --values monitoring/grafana-values.yaml

# Get Grafana password
kubectl get secret grafana -n austa-production -o jsonpath="{.data.admin-password}" | base64 --decode
```

## CI/CD Setup - GitHub Actions

### 1. Configure GitHub Secrets

Go to repository Settings > Secrets and add:

```
Required Secrets:
- KUBE_CONFIG_PRODUCTION (base64 encoded kubeconfig)
- KUBE_CONFIG_STAGING (base64 encoded kubeconfig)
- DATABASE_URL
- MONGODB_URI
- REDIS_PASSWORD
- JWT_SECRET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- OPENAI_API_KEY
- WHATSAPP_ACCESS_TOKEN
```

### 2. Enable GitHub Container Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push images (done automatically by CI/CD)
docker build -t ghcr.io/your-org/backend:latest ./backend
docker push ghcr.io/your-org/backend:latest
```

### 3. Trigger Deployment

```bash
# Push to develop for staging deployment
git push origin develop

# Push to main for production deployment
git push origin main

# Monitor workflow
# Go to Actions tab in GitHub
```

## Database Migration

### Production Database Setup

```bash
# Connect to backend pod
kubectl exec -it deployment/backend -n austa-production -- /bin/sh

# Run migrations
npm run db:migrate

# Seed initial data (if needed)
npm run db:seed

# Exit pod
exit
```

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@austa-care.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Certificates will be automatically provisioned
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend --replicas=5 -n austa-production

# Scale frontend
kubectl scale deployment frontend --replicas=3 -n austa-production
```

### Autoscaling (HPA configured)

Autoscaling is already configured in `k8s/hpa.yaml`:
- Backend: 3-10 replicas based on CPU/Memory
- Frontend: 2-5 replicas based on CPU/Memory

## Backup and Recovery

### Database Backups

```bash
# Backup PostgreSQL
kubectl exec -n austa-production postgres-0 -- pg_dump -U austa_user austa_care > backup.sql

# Restore PostgreSQL
kubectl exec -i -n austa-production postgres-0 -- psql -U austa_user austa_care < backup.sql

# Backup MongoDB
kubectl exec -n austa-production mongodb-0 -- mongodump --out=/tmp/backup

# Restore MongoDB
kubectl exec -n austa-production mongodb-0 -- mongorestore /tmp/backup
```

## Monitoring and Alerting

### Access Dashboards

```bash
# Port-forward Grafana
kubectl port-forward -n austa-production svc/grafana 3000:80

# Access: http://localhost:3000
# Login with admin credentials

# Port-forward Prometheus
kubectl port-forward -n austa-production svc/prometheus 9090:9090

# Access: http://localhost:9090
```

### View Metrics

- System Health: Grafana > Dashboards > System Health
- API Performance: Grafana > Dashboards > API Performance
- Error Rate: Grafana > Dashboards > Error Monitoring

## Troubleshooting

### Pod Issues

```bash
# Describe pod
kubectl describe pod <pod-name> -n austa-production

# View logs
kubectl logs <pod-name> -n austa-production

# Get events
kubectl get events -n austa-production --sort-by='.lastTimestamp'

# Debug pod
kubectl exec -it <pod-name> -n austa-production -- /bin/sh
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
kubectl run -it --rm psql --image=postgres:15 --restart=Never -- \
  psql -h postgres.austa-production.svc.cluster.local -U austa_user -d austa_care

# Test MongoDB connection
kubectl run -it --rm mongo --image=mongo:7 --restart=Never -- \
  mongosh mongodb://austa-admin:password@mongodb.austa-production.svc.cluster.local:27017

# Test Redis connection
kubectl run -it --rm redis --image=redis:7 --restart=Never -- \
  redis-cli -h redis.austa-production.svc.cluster.local -a password ping
```

### Network Issues

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup backend.austa-production.svc.cluster.local

# Test connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://backend.austa-production.svc.cluster.local:3000/health
```

## Performance Tuning

### Resource Optimization

```bash
# View resource usage
kubectl top pods -n austa-production
kubectl top nodes

# Adjust resources
kubectl set resources deployment backend \
  --requests=cpu=500m,memory=1Gi \
  --limits=cpu=2000m,memory=4Gi \
  -n austa-production
```

### Database Optimization

- Enable connection pooling (already configured)
- Configure query caching
- Add database indexes
- Monitor slow queries

## Security Checklist

- [ ] All secrets stored in Kubernetes Secrets
- [ ] HTTPS/TLS enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] Security headers configured
- [ ] Container security scanning enabled
- [ ] Network policies configured
- [ ] RBAC policies configured
- [ ] Audit logging enabled
- [ ] Backup strategy implemented

## Rollback Procedure

```bash
# Rollback backend deployment
kubectl rollout undo deployment/backend -n austa-production

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n austa-production

# Check rollout history
kubectl rollout history deployment/backend -n austa-production

# Check rollout status
kubectl rollout status deployment/backend -n austa-production
```

## Support

For deployment support:
- Documentation: https://docs.austa-care.com
- DevOps Team: devops@austa-care.com
- On-call: +1-XXX-XXX-XXXX

## Next Steps

1. Configure monitoring alerts
2. Setup backup automation
3. Implement disaster recovery plan
4. Configure log aggregation
5. Setup APM (Application Performance Monitoring)
6. Implement feature flags
7. Configure blue-green deployments
