# AUSTA Care Platform — Operations Runbook

> **Última atualização**: 2026-06-27  
> **Status**: Alpha / Pre-Production  
> **Deploy atual**: Docker Compose (dev) + VM única (produção planejada)  
> **Kubernetes**: Aspiracional — NÃO está em produção ainda

---

## 1. System Architecture Overview

### 1.1 O que REALMENTE roda (Jun/2026)

```
┌──────────────────────────────────────────────────┐
│               VM / Servidor Único                 │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │        Docker Compose Stack                   │ │
│  │                                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │ │
│  │  │ Backend  │  │PostgreSQL│  │  Redis 7  │  │ │
│  │  │ Express  │  │   15     │  │ (cache)   │  │ │
│  │  │ :3000    │  │  :5432   │  │  :6379    │  │ │
│  │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │ │
│  │       │              │              │         │ │
│  │       └──────────────┼──────────────┘         │ │
│  │                      │                        │ │
│  └──────────────────────┼────────────────────────┘ │
│                         │                          │
│  Serviços Externos:     │                          │
│  ┌──────────┐  ┌────────┴────┐  ┌─────────────┐  │
│  │ Z-API    │  │  OpenAI     │  │  Prometheus  │  │
│  │WhatsApp  │  │  GPT-4      │  │  (local)     │  │
│  └──────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────┘
```

### 1.2 Componentes

| Componente | Tecnologia | Porta | Health Check |
|-----------|-----------|-------|-------------|
| Backend API | Node.js 18+/Express/TypeScript | 3000 | `GET /health` |
| PostgreSQL | PostgreSQL 15 + pgcrypto | 5432 | `pg_isready` |
| Redis | Redis 7 (ioredis) | 6379 | `redis-cli ping` |
| WhatsApp | Z-API (z-api.io) | N/A | Via API status |
| AI/NLP | OpenAI GPT-4 via LangChain | N/A | Via API status |

### 1.3 Arquitetura Futura (Aspiracional)

```
┌──────────────────────────────────────────────────┐
│  Kubernetes (EKS/GKE) — NÃO em produção ainda     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Backend │ │ Backend │ │ Backend │  (3+ pods) │
│  │ Pod     │ │ Pod     │ │ Pod     │            │
│  └────┬────┘ └────┬────┘ └────┬────┘            │
│       └───────────┼───────────┘                  │
│                   │                              │
│  ┌────────────────┴────────────────┐             │
│  │        RDS PostgreSQL           │             │
│  └─────────────────────────────────┘             │
│  ┌─────────────────────────────────┐             │
│  │        ElastiCache Redis        │             │
│  └─────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

---

## 2. Deploy Procedures

### 2.1 Deploy Staging (Local / VM)

```bash
# 1. Atualizar código
cd /opt/austa-care-platform
git pull origin main

# 2. Rebuild e restart
docker compose down
docker compose up -d --build postgres redis backend

# 3. Rodar migrations
docker compose exec backend npx prisma migrate deploy

# 4. Verificar health
curl -s http://localhost:3000/health | jq .
# Esperado: { "status": "healthy", ... }
```

### 2.2 Deploy Produção (VM Única — atual)

```bash
# 1. Acessar servidor de produção
ssh austa-prod

# 2. Entrar no diretório do projeto
cd /opt/austa-care-platform

# 3. Pull e rebuild
git fetch origin
git checkout main
git pull origin main

# 4. Build e restart com Docker Compose
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --build postgres redis backend

# 5. Rodar migrations (NUNCA pular)
docker compose exec backend npx prisma migrate deploy

# 6. Smoke test
curl -s http://localhost:3000/health | jq .status
# Esperado: "healthy"

# 7. Verificar logs
docker compose logs backend --tail=50
```

### 2.3 Deploy Manual (sem Docker Compose)

```bash
# Build
cd austa-care-platform/backend
npm install
npm run build

# Iniciar (com PM2 recomendado)
pm2 start dist/server.js --name austa-backend
pm2 save
```

---

## 3. Health Check Interpretation

### 3.1 Endpoints

| Endpoint | Uso | HTTP 200 = |
|----------|-----|-----------|
| `GET /health` | Component-level check | DB + Encryption OK, Redis opcional |
| `GET /health/dead-mans-switch` | Atividade do sistema | Sistema ativo (última atividade < threshold) |
| `GET /health/ready` | Readiness probe | DB + Encryption OK (críticos) |
| `GET /health/live` | Liveness probe | Processo Node.js rodando |

### 3.2 Interpretação do HealthResponse

```json
{
  "status": "healthy",     // healthy | degraded | unhealthy
  "components": {
    "database": { "status": "up", "latencyMs": 2 },
    "redis":    { "status": "up", "latencyMs": 1 },   // opcional
    "encryption": { "status": "up", "algorithm": "aes256" }
  }
}
```

**Estados**:
- `healthy`: Database UP + Encryption UP (Redis opcional)
- `degraded`: Database UP + Encryption UP, mas Redis DOWN — sistema opera sem cache
- `unhealthy`: Database DOWN ou Encryption DOWN — **sistema não funciona**

### 3.3 Verificação via CLI

```bash
# Health completo
curl -s http://localhost:3000/health | jq .

# Dead man's switch
curl -s http://localhost:3000/health/dead-mans-switch | jq .

# Readiness
curl -s http://localhost:3000/health/ready | jq .

# Liveness
curl -s http://localhost:3000/health/live | jq .
```

### 3.4 Dead Man's Switch

O dead man's switch é atualizado a cada requisição autenticada (`touchActivity()` no middleware). Se nenhum usuário autenticado usar o sistema por mais de `DEAD_MANS_SWITCH_THRESHOLD_MS` (default: 300000ms = 5 min), o endpoint retorna 503.

**Configuração**:
```bash
# No .env
DEAD_MANS_SWITCH_THRESHOLD_MS=300000  # 5 minutos (default)
```

### 3.5 Métricas Prometheus

```bash
# Endpoint de métricas (se configurado)
curl -s http://localhost:3000/metrics | grep austa_

# Métricas chave:
# - austa_http_requests_total
# - austa_http_request_duration_seconds
# - austa_api_errors_total
# - austa_db_query_duration_seconds
# - austa_encryption_health_status
```

---

## 4. Common Alerts and Response Procedures

### 4.1 HighApiErrorRate

**Sintoma**: Taxa de erro 5xx acima de 5% em janela de 5 minutos.

**Resposta**:
```bash
# 1. Verificar logs de erro recentes
docker compose logs backend --tail=200 | grep -i error

# 2. Verificar health dos componentes
curl -s http://localhost:3000/health | jq .

# 3. Se database down:
docker compose logs postgres --tail=50
docker compose restart postgres

# 4. Se erro for de código (nova versão):
# Rollback de imagem Docker
docker compose down backend
# Editar docker-compose.yml para usar a tag anterior
docker compose up -d backend

# 5. Verificar uso de recursos
docker stats --no-stream
```

### 4.2 DeadMansSwitchSilent

**Sintoma**: `GET /health/dead-mans-switch` retorna `status: "stale"` com HTTP 503.

**Resposta**:
```bash
# 1. Verificar se o backend está rodando
docker compose ps backend

# 2. Verificar se o processo está respondendo
curl -v http://localhost:3000/health/live

# 3. Se o container está rodando mas não responde:
docker compose restart backend

# 4. Verificar logs para causa raiz
docker compose logs backend --tail=100

# 5. Se o sistema está ativo mas sem requisições autenticadas,
#    isso é esperado em ambientes com baixo tráfego.
#    Ajustar threshold se necessário:
#    DEAD_MANS_SWITCH_THRESHOLD_MS=600000  # 10 min
```

### 4.3 DatabaseConnectionFailure

**Sintoma**: `GET /health` mostra `database.status: "down"`.

**Resposta**:
```bash
# 1. Verificar se PostgreSQL está rodando
docker compose ps postgres
docker compose logs postgres --tail=50

# 2. Verificar conectividade
docker compose exec postgres pg_isready -U austa_user -d austa_care

# 3. Se o container está parado:
docker compose up -d postgres

# 4. Se pg_isready falha mas container roda:
# Verificar disco
df -h /var/lib/docker/volumes/

# 5. Verificar locks no banco
docker compose exec postgres psql -U austa_user -d austa_care -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '5 minutes';"

# 6. Se disco cheio:
# - Limpar logs antigos
# - Expadir volume Docker
# - NUNCA deletar dados do banco sem backup
```

### 4.4 RedisUnavailable

**Sintoma**: `GET /health` mostra `redis.status: "down"`.

**Impacto**: Sistema opera em modo degradado — sem cache, sem rate limiting via Redis.

**Resposta**:
```bash
# 1. Verificar Redis
docker compose ps redis
docker compose logs redis --tail=30

# 2. Tentar ping
docker compose exec redis redis-cli ping

# 3. Reiniciar se necessário
docker compose restart redis

# 4. Redis é opcional — sistema continua funcionando sem cache.
#    Isso é esperado em desenvolvimento. Em produção, restaurar ASAP.
```

### 4.5 EncryptionHealthCheckFailed

**Sintoma**: `GET /health` mostra `encryption.status: "down"`.

**IMPACTO CRÍTICO**: Dados PHI/PII podem estar sendo armazenados SEM criptografia. Violação LGPD.

**Resposta**:
```bash
# 1. Verificar se pgcrypto está instalado
docker compose exec postgres psql -U austa_user -d austa_care -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';"

# 2. Se NÃO estiver instalado → INSTALAR IMEDIATAMENTE
docker compose exec postgres psql -U austa_user -d austa_care -c \
  "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 3. Verificar permissões do usuário
docker compose exec postgres psql -U austa_user -d austa_care -c \
  "SELECT current_user, session_user;"

# 4. Verificar se o backend reconhece a extensão
curl -s http://localhost:3000/health | jq '.components.encryption'

# 5. Se o erro persistir, verificar logs do backend
docker compose logs backend --tail=50 | grep -i encrypt
```

---

## 5. Backup and Restore (PostgreSQL)

### 5.1 Backup Manual

```bash
# Backup completo (formato custom — recomendado)
docker compose exec postgres pg_dump \
  -U austa_user -d austa_care \
  --format=custom \
  --compress=9 \
  --file=/tmp/austa_backup_$(date +%Y%m%d_%H%M%S).dump

# Copiar para máquina local
docker cp austa-postgres:/tmp/austa_backup_*.dump ./backups/

# Alternativa: backup SQL plain-text (para inspeção humana)
docker compose exec postgres pg_dump \
  -U austa_user -d austa_care \
  --clean --if-exists \
  > ./backups/austa_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 5.2 Backup Automatizado (Cron)

Adicionar ao crontab do servidor:

```bash
# /etc/cron.d/austa-backup
# Backup diário às 2h da manhã
0 2 * * * root cd /opt/austa-care-platform && \
  docker compose exec -T postgres pg_dump -U austa_user -d austa_care --format=custom --compress=9 \
  > /backups/austa_backup_$(date +\%Y\%m\%d).dump && \
  find /backups -name "austa_backup_*.dump" -mtime +30 -delete
```

### 5.3 Restore

```bash
# ⚠️ AVISO: Restore sobrescreve dados existentes!

# 1. Parar o backend (evitar writes durante restore)
docker compose stop backend

# 2. Restaurar de dump custom
docker compose exec -T postgres pg_restore \
  -U austa_user -d austa_care \
  --clean --if-exists \
  < ./backups/austa_backup_20260627_120000.dump

# 3. Ou restaurar de SQL plain-text
docker compose exec -T postgres psql \
  -U austa_user -d austa_care \
  < ./backups/austa_backup_20260627_120000.sql

# 4. Reindexar
docker compose exec postgres psql -U austa_user -d austa_care -c "REINDEX DATABASE austa_care;"

# 5. Reiniciar backend
docker compose start backend

# 6. Verificar
curl -s http://localhost:3000/health | jq .status
```

### 5.4 Verificar Integridade do Backup

```bash
# Listar conteúdo do dump sem restaurar
docker compose exec -T postgres pg_restore --list \
  < ./backups/austa_backup_20260627_120000.dump | head -50
```

---

## 6. Secret Rotation Procedure

### 6.1 Secrets Gerenciados

| Secret | Localização | Rotação | Impacto |
|--------|------------|---------|---------|
| `JWT_SECRET` | `.env` | 90 dias | Invalida todos os tokens ativos |
| `DATABASE_URL` | `.env` | 30 dias | Requer restart do backend |
| `ENCRYPTION_KEY` | `.env` / pgcrypto | **180 dias** | ⚠️ NÃO rotacionar sem migração de dados |
| `WHATSAPP_TOKEN` | `.env` | Sob demanda | Atualizar no Z-API |
| `OPENAI_API_KEY` | `.env` | Conforme política OpenAI | Atualizar .env e restart |

### 6.2 Procedimento de Rotação (JWT)

```bash
# 1. Gerar novo secret
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "Novo JWT_SECRET: $NEW_JWT_SECRET"

# 2. Atualizar .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env

# 3. Restart do backend
docker compose restart backend

# 4. Verificar
curl -s http://localhost:3000/health | jq .status
# Esperado: "healthy"

# ⚠️ Todos os tokens existentes serão invalidados.
# Usuários precisarão fazer login novamente.
```

### 6.3 Rotação de ENCRYPTION_KEY

**⚠️ CRÍTICO**: A chave de criptografia (`ENCRYPTION_KEY` / `pgcrypto`) NÃO pode ser rotacionada sem um plano de migração completo.

```
Procedimento requer:
1. Gerar nova chave
2. Descriptografar TODOS os dados PHI/PII com a chave antiga
3. Re-criptografar com a nova chave
4. Verificar integridade de todos os registros
5. Atualizar a chave no .env

Este procedimento NÃO é coberto por este runbook.
Requer aprovação do DPO e CTO.
```

---

## 7. Emergency Contacts (Placeholders)

| Papel | Contato | Canal |
|-------|---------|-------|
| Tech Lead / On-call | [NOME] — [TELEFONE] | WhatsApp / PagerDuty |
| DevOps / Infra | [NOME] — [TELEFONE] | WhatsApp |
| DPO (LGPD) | [NOME] — [EMAIL] | Email / Slack |
| Security | [NOME] — [EMAIL] | Slack #security |
| Z-API Support | [suporte@z-api.io] | Email / Painel Z-API |

**Escalação**:
1. Tech Lead on-call → **15 min**
2. DevOps on-call → **30 min**
3. CTO → **1 hora**

---

## 8. Rollback Procedure

### 8.1 Rollback de Código (Docker Compose)

```bash
# 1. Identificar a tag/imagem estável anterior
docker images austa-backend

# 2. Editar docker-compose.yml para usar a tag anterior
#    ou fazer checkout do commit estável
git log --oneline -10
git checkout <COMMIT_ESTAVEL>

# 3. Rebuild e restart
docker compose up -d --build backend

# 4. Verificar
curl -s http://localhost:3000/health | jq .status
```

### 8.2 Rollback de Migration Prisma

```bash
# ⚠️ Pode causar perda de dados! Use com extrema cautela.

# 1. Listar migrações aplicadas
docker compose exec backend npx prisma migrate status

# 2. Rollback de uma migração específica
docker compose exec backend npx prisma migrate resolve --rolled-back MIGRATION_NAME

# 3. Verificar schema
docker compose exec backend npx prisma migrate status
```

### 8.3 Rollback de Restore (Pior Caso)

Se o rollback normal falhar, restaurar do backup:

```bash
# Ver seção 5.3 — Restore
```

---

## 9. Quick Reference (Cheat Sheet)

```bash
# === STATUS ===
docker compose ps
docker stats --no-stream
curl -s http://localhost:3000/health | jq .status

# === LOGS ===
docker compose logs backend --tail=100
docker compose logs backend --tail=100 | grep ERROR
docker compose logs postgres --tail=50

# === RESTART ===
docker compose restart backend
docker compose restart postgres

# === DEPLOY ===
git pull origin main
docker compose up -d --build backend
docker compose exec backend npx prisma migrate deploy

# === ROLLBACK ===
git checkout <COMMIT_ESTAVEL>
docker compose up -d --build backend

# === DB ===
docker compose exec postgres psql -U austa_user -d austa_care -c "SELECT 1"

# === BACKUP ===
docker compose exec postgres pg_dump -U austa_user -d austa_care \
  --format=custom --compress=9 -f /tmp/backup_$(date +%Y%m%d).dump
docker cp austa-postgres:/tmp/backup_*.dump ./backups/

# === METRICS ===
curl -s http://localhost:3000/metrics | grep austa_
curl -s http://localhost:3000/health/dead-mans-switch | jq .
```

---

## 10. Procedimentos de Manutenção

### 10.1 Janela de Manutenção Programada

```bash
# 1. Notificar stakeholders (24h antes)
# 2. Fazer backup (seção 5.1)
# 3. Executar manutenção
# 4. Verificar health
curl -s http://localhost:3000/health | jq .
# 5. Smoke test de endpoints principais
```

### 10.2 Limpeza de Dados Conforme LGPD

```bash
# Soft-delete de dados de paciente (LGPD Art. 18)
# NÃO use DELETE direto — use soft-delete via Prisma
docker compose exec backend npx tsx -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  // Soft delete user data
  prisma.user.update({
    where: { id: 'USER_ID' },
    data: { deletedAt: new Date(), status: 'DELETED' }
  }).then(() => console.log('Done'));
"
```

---

**🏥 AUSTA Care Platform — Runbook | Junho 2026 | Alpha/Pre-Production**
