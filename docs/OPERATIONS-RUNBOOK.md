# AUSTA Care Platform — Operations Runbook

> **Última atualização**: 2025-06-26  
> **Escopo**: Ambiente staging + produção  
> **Plataforma**: Kubernetes (EKS) + Docker Compose (dev)

---

## 1. Arquitetura de Deploy

```
┌──────────────────────────────────────────────┐
│                   CI/CD                       │
│  GitHub Actions → Build → Push ECR → Deploy   │
└──────────────────┬───────────────────────────┘
                   │
    ┌──────────────▼──────────────┐
    │     EKS Cluster (AWS)       │
    │                             │
    │  ┌───────────────────────┐  │
    │  │ austa-care-backend    │  │
    │  │ (Node.js/Express)     │  │
    │  │ Port: 3000            │  │
    │  └───────────┬───────────┘  │
    │              │               │
    │  ┌───────────▼───────────┐  │
    │  │   PostgreSQL 15       │  │
    │  │   (RDS / pgcrypto)    │  │
    │  └───────────────────────┘  │
    │                             │
    │  ┌───────────────────────┐  │
    │  │   Redis 7              │  │
    │  │   (ElastiCache)        │  │
    │  └───────────────────────┘  │
    │                             │
    │  ┌───────────────────────┐  │
    │  │   Kafka (MSK)          │  │
    │  └───────────────────────┘  │
    └─────────────────────────────┘
```

---

## 2. Deploy

### 2.1 Deploy Staging

```bash
# 1. Fazer merge em staging
git checkout staging
git merge main
git push origin staging

# 2. CI/CD automaticamente builda e deploya
#    Pipeline: .github/workflows/deploy-staging.yml
```

**Verificar status do deploy:**
```bash
# Verificar pods
kubectl get pods -n austa-staging -l app=austa-backend

# Ver logs do deploy
kubectl logs -n austa-staging deployment/austa-backend --tail=100

# Ver rollout status
kubectl rollout status deployment/austa-backend -n austa-staging
```

### 2.2 Deploy Produção

```bash
# 1. Criar release tag
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 2. CI/CD deploya via GitHub Actions
#    Pipeline: .github/workflows/deploy-prod.yml
```

**Deploy manual (emergência):**
```bash
# Build imagem
docker build -t austa-backend:latest -f backend/Dockerfile .

# Push para ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag austa-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/austa-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/austa-backend:latest

# Aplicar manifests
kubectl apply -f k8s/production/
kubectl rollout restart deployment/austa-backend -n austa-prod
```

---

## 3. Health Checks

### 3.1 Endpoints de Health

| Endpoint                    | Uso                          | Esperado |
|-----------------------------|------------------------------|----------|
| `GET /health`               | Liveness (básico)            | `200` + `{"status":"healthy"}` |
| `GET /health/detailed`      | Componentes (DB, Redis, Enc) | `200` ou `503` se degradado |
| `GET /health/dead-mans-switch` | Atividade do sistema       | `200` alive / `503` stale |
| `GET /health/ready`         | Readiness (K8s)              | `200` ou `503` |
| `GET /health/live`          | Liveness (K8s)               | `200` |
| `GET /metrics`              | Prometheus metrics           | `200` + texto Prometheus |

### 3.2 Verificar via CLI

```bash
# Health básico
curl -s http://localhost:3000/health | jq .

# Health detalhado
curl -s http://localhost:3000/health/detailed | jq .

# Dead man's switch
curl -s http://localhost:3000/health/dead-mans-switch | jq .

# Kubernetes probes
kubectl exec -n austa-prod deployment/austa-backend -- \
  curl -s http://localhost:3000/health/ready
```

### 3.3 Logs

```bash
# Últimos 100 logs do backend
kubectl logs -n austa-prod deployment/austa-backend --tail=100

# Logs com filtro de erro
kubectl logs -n austa-prod deployment/austa-backend --tail=500 | grep -i error

# Seguir logs em tempo real
kubectl logs -n austa-prod deployment/austa-backend -f

# Logs do PostgreSQL
kubectl logs -n austa-prod deployment/austa-postgres --tail=100
```

### 3.4 Métricas Prometheus

```bash
# Endpoint de métricas
curl -s http://localhost:3000/metrics | grep austa_

# Métricas chave:
# - austa_http_requests_total
# - austa_http_request_duration_seconds
# - austa_api_errors_total
# - austa_db_query_duration_seconds
# - austa_encryption_health_status
```

### 3.5 Dashboard Grafana

```
URL: https://grafana.austa.care
Dashboard: "AUSTA Care - Platform Overview"
Panels chave:
  - HTTP Request Rate (4xx/5xx)
  - P95 Latency
  - Database Connection Pool
  - Encryption Health
  - Dead Man's Switch Status
  - Audit Log Write Success Rate
```

---

## 4. Alertas e Resposta

### 4.1 HighApiErrorRate

**Alerta**: `rate(http_requests_total{status=~"5.."}[5m]) > 0.05`

**Resposta**:
```bash
# 1. Verificar logs de erro
kubectl logs -n austa-prod deployment/austa-backend --tail=200 | grep -i error

# 2. Verificar métricas detalhadas
curl -s http://POD_IP:3000/metrics | grep austa_api_errors

# 3. Verificar dependências
curl -s http://localhost:3000/health/detailed | jq .

# 4. Se erro for de banco → verificar RDS
aws rds describe-db-instances --db-instance-identifier austa-prod

# 5. Se erro for de código → rollback (ver seção 5)
kubectl rollout undo deployment/austa-backend -n austa-prod

# 6. Se erro for de infra → verificar AWS Health Dashboard
aws health describe-events --filter region=us-east-1
```

### 4.2 DeadMansSwitchSilent

**Alerta**: `austa_dead_mans_switch_status == 0` (stale > 5 min)

**Resposta**:
```bash
# 1. Verificar se os pods estão rodando
kubectl get pods -n austa-prod -l app=austa-backend

# 2. Verificar status do deployment
kubectl describe deployment austa-backend -n austa-prod

# 3. Verificar eventos recentes
kubectl get events -n austa-prod --sort-by='.lastTimestamp' | tail -20

# 4. Verificar se o serviço está respondendo
curl -v http://localhost:3000/health 2>&1 | head -20

# 5. Se pods estão rodando mas não respondem → reiniciar
kubectl rollout restart deployment/austa-backend -n austa-prod

# 6. Verificar CPU/Memória
kubectl top pods -n austa-prod -l app=austa-backend
```

### 4.3 AuditLogPersistenceFailed

**Alerta**: `rate(austa_audit_log_write_failures_total[5m]) > 0`

**Resposta**:
```bash
# 1. Verificar conexão PostgreSQL
kubectl exec -n austa-prod deployment/austa-backend -- \
  node -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().\$queryRawUnsafe('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error(e))"

# 2. Verificar espaço em disco do RDS
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=austa-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average

# 3. Verificar locks no PostgreSQL
kubectl exec -n austa-prod deployment/austa-postgres -- \
  psql -U austa_user -d austa_care -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '5 minutes';"

# 4. Se banco estiver cheio → escalar storage ou limpar
#    Atenção: NUNCA deletar dados de auditoria — são exigidos por compliance.
#    Escalar storage ou arquivar logs antigos para S3.
```

### 4.4 EncryptionHealthCheckFailed

**Alerta**: `austa_encryption_health_status == 0`

**Resposta**:
```bash
# 1. Verificar se pgcrypto extension está instalada
kubectl exec -n austa-prod deployment/austa-postgres -- \
  psql -U austa_user -d austa_care -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';"

# 2. Se não estiver instalada → INSTALAR IMEDIATAMENTE
kubectl exec -n austa-prod deployment/austa-postgres -- \
  psql -U austa_user -d austa_care -c \
  "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 3. Verificar se o backend reconhece a extensão
curl -s http://localhost:3000/health/detailed | jq '.services.encryption'

# 4. Verificar permissões do usuário do banco
kubectl exec -n austa-prod deployment/austa-postgres -- \
  psql -U austa_user -d austa_care -c \
  "SELECT current_user, session_user;"
```

---

## 5. Rollback

### 5.1 Rollback Kubernetes

```bash
# Ver histórico de revisões
kubectl rollout history deployment/austa-backend -n austa-prod

# Rollback para revisão anterior
kubectl rollout undo deployment/austa-backend -n austa-prod

# Rollback para revisão específica
kubectl rollout undo deployment/austa-backend -n austa-prod --to-revision=3

# Verificar status do rollback
kubectl rollout status deployment/austa-backend -n austa-prod
```

### 5.2 Rollback de Migração Prisma

```bash
# Listar migrações aplicadas
kubectl exec -n austa-prod deployment/austa-backend -- \
  npx prisma migrate status

# Rollback de migração (⚠️ pode causar perda de dados)
kubectl exec -n austa-prod deployment/austa-backend -- \
  npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### 5.3 Rollback Manual de Imagem

```bash
# Tag a imagem estável anterior
kubectl set image deployment/austa-backend \
  austa-backend=123456789.dkr.ecr.us-east-1.amazonaws.com/austa-backend:v1.1.9 \
  -n austa-prod
```

---

## 6. Backup e Restore (PostgreSQL)

### 6.1 Backup

```bash
# Backup completo via pg_dump
kubectl exec -n austa-prod deployment/austa-postgres -- \
  pg_dump -U austa_user -d austa_care \
  --format=custom \
  --compress=9 \
  --file=/tmp/austa_backup_$(date +%Y%m%d_%H%M%S).dump

# Copiar para máquina local
kubectl cp austa-prod/POD_NAME:/tmp/austa_backup_*.dump ./backups/

# Upload para S3
aws s3 cp ./backups/austa_backup_*.dump \
  s3://austa-backups/production/$(date +%Y)/$(date +%m)/ \
  --storage-class STANDARD_IA
```

### 6.2 Backup Automatizado (RDS)

O RDS faz snapshots automáticos diários. Verificar:

```bash
# Listar snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier austa-prod \
  --snapshot-type automated \
  --query "DBSnapshots[-5:].{Time:SnapshotCreateTime,Id:DBSnapshotIdentifier}" \
  --output table
```

### 6.3 Restore

```bash
# Restaurar de dump custom
kubectl exec -n austa-prod deployment/austa-postgres -- \
  pg_restore -U austa_user -d austa_care \
  --clean \
  --if-exists \
  /tmp/austa_backup_20250626_120000.dump

# Restaurar de snapshot RDS
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier austa-prod-restored \
  --db-snapshot-identifier rds:austa-prod-2025-06-26-00-00
```

### 6.4 Verificar Integridade do Backup

```bash
# pg_restore com --list para verificar conteúdo sem restaurar
kubectl exec -n austa-prod deployment/austa-postgres -- \
  pg_restore --list /tmp/austa_backup_20250626_120000.dump | head -50
```

---

## 7. Rotação de Secrets (AWS Secrets Manager)

### 7.1 Secrets Gerenciados

| Secret                      | Rotação   | Impacto                               |
|-----------------------------|-----------|---------------------------------------|
| `austa/prod/jwt-secret`     | 90 dias   | Invalida todos os tokens — requer redeploy |
| `austa/prod/db-password`    | 30 dias   | Requer atualização no connection string |
| `austa/prod/encryption-key` | 180 dias  | NÃO rotacionar sem migração de dados    |
| `austa/prod/zapi-token`     | Sob demanda | Atualizar no WhatsApp Business API    |

### 7.2 Procedimento

```bash
# 1. Gerar novo secret
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# 2. Atualizar no AWS Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id austa/prod/jwt-secret \
  --secret-string "{\"JWT_SECRET\":\"$NEW_JWT_SECRET\"}"

# 3. Atualizar Kubernetes secret
kubectl create secret generic austa-secrets \
  --from-literal=JWT_SECRET="$NEW_JWT_SECRET" \
  --dry-run=client -o yaml | \
  kubectl apply -f - -n austa-prod

# 4. Rolling restart dos pods
kubectl rollout restart deployment/austa-backend -n austa-prod

# 5. Verificar
kubectl rollout status deployment/austa-backend -n austa-prod
curl -s http://localhost:3000/health | jq .status
```

**⚠️ IMPORTANTE**: Rotação de `encryption-key` requer migração completa dos dados criptografados.  
**NÃO rotacione** sem plano de migração aprovado.

---

## 8. Contatos de Emergência

| Papel                  | Contato                  | Canal              |
|------------------------|--------------------------|--------------------|
| Tech Lead / On-call    | [NOME] — [TELEFONE]     | PagerDuty / WhatsApp |
| DevOps / Infra         | [NOME] — [TELEFONE]     | PagerDuty           |
| DPO (LGPD)             | [NOME] — [EMAIL]        | Email / Slack       |
| Security               | [NOME] — [EMAIL]        | Slack #security     |
| AWS Support (Enterprise)| Via AWS Console        | Caso AWS            |

**Escalação**:
1. Tech Lead on-call → **15 min**
2. DevOps on-call → **30 min**
3. CTO → **1 hora**
4. AWS Enterprise Support → **simultâneo** se suspeita de infra

---

## 9. Comandos Rápidos (Cheat Sheet)

```bash
# === STATUS ===
kubectl get pods -n austa-prod
kubectl top pods -n austa-prod
curl -s http://localhost:3000/health | jq .status

# === LOGS ===
kubectl logs -n austa-prod deployment/austa-backend --tail=100
kubectl logs -n austa-prod deployment/austa-backend --tail=100 | grep ERROR

# === DEPLOY ===
kubectl rollout status deployment/austa-backend -n austa-prod
kubectl rollout history deployment/austa-backend -n austa-prod

# === ROLLBACK ===
kubectl rollout undo deployment/austa-backend -n austa-prod

# === RESTART ===
kubectl rollout restart deployment/austa-backend -n austa-prod

# === SCALE ===
kubectl scale deployment austa-backend --replicas=3 -n austa-prod

# === DB ===
kubectl exec -n austa-prod deployment/austa-postgres -- psql -U austa_user -d austa_care -c "SELECT 1"

# === METRICS ===
curl -s http://localhost:3000/metrics | grep austa_api_errors_total
```

---

## 10. Procedimentos de Manutenção

### 10.1 Janela de Manutenção Programada

```bash
# 1. Notificar stakeholders (24h antes)
# 2. Colocar modo de manutenção (opcional)
kubectl create configmap maintenance-mode \
  --from-literal=ENABLED=true -n austa-prod

# 3. Executar manutenção

# 4. Remover modo de manutenção
kubectl delete configmap maintenance-mode -n austa-prod

# 5. Verificar health
curl -s http://localhost:3000/health/detailed | jq .
```

### 10.2 Limpeza de Dados Conforme LGPD

Dados de pacientes têm períodos de retenção definidos. A limpeza é feita via job agendado:

```bash
# Verificar status do job de retenção LGPD
kubectl get cronjobs -n austa-prod

# Executar manualmente se necessário
kubectl create job --from=cronjob/lgpd-retention-cleanup \
  lgpd-manual-$(date +%Y%m%d) -n austa-prod
```
