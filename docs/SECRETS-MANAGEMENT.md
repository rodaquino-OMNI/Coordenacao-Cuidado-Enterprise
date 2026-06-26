# AUSTA Care Platform — Secrets Management Strategy

## Overview

This document describes how secrets (passwords, API keys, tokens, encryption keys) are managed across all AUSTA Care Platform environments. **No secret is ever hardcoded in source files or committed to version control.**

## Quick Reference

| Environment | Secret Store | How Secrets Reach the App |
|---|---|---|
| **Local Development** | `.env` file | `dotenv` loads into `process.env` at startup |
| **Staging** | AWS Secrets Manager | `@aws-sdk/client-secrets-manager` fetches secrets at boot |
| **Production** | AWS Secrets Manager (with automatic rotation) | Same SDK, plus Lambda‑based rotation for RDS/Redis |

---

## 1. Local Development

### Secrets are stored in `.env`

```
cp .env.example .env
./scripts/generate-dev-secrets.sh   # generates strong random passwords
```

- The `.env` file is **gitignored** (see `.gitignore` lines 6‑12).
- `docker-compose.yml` and `docker-compose.infrastructure.yml` reference `${VARIABLE:-default}` — no hardcoded passwords.
- `austa-care-platform/backend/src/config/config.ts` loads `.env` via `dotenv` and validates with Zod.

### Variables used by Docker Compose

All service credentials are injected via environment variables:

| Variable | Service | Example |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL | `${POSTGRES_PASSWORD:-change_me_in_production}` |
| `MONGO_INITDB_ROOT_PASSWORD` | MongoDB | `${MONGO_INITDB_ROOT_PASSWORD:-change_me_in_production}` |
| `MINIO_ROOT_PASSWORD` | MinIO | `${MINIO_ROOT_PASSWORD:-change_me_in_production}` |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana | `${GF_SECURITY_ADMIN_PASSWORD:-change_me_in_production}` |
| `PGADMIN_DEFAULT_PASSWORD` | pgAdmin | `${PGADMIN_DEFAULT_PASSWORD:-change_me_in_production}` |

### Generating Secrets for Development

```bash
# Make executable (first time)
chmod +x scripts/generate-dev-secrets.sh

# Generate fresh secrets
./scripts/generate-dev-secrets.sh
```

The script:
1. Copies `.env.example` → `.env`
2. Generates cryptographically strong random secrets via `openssl rand -base64`
3. Replaces all placeholder values in `.env`
4. Outputs a summary of what was generated

⚠️ **You still need to manually set** `OPENAI_API_KEY`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, and AWS credentials — those cannot be auto‑generated.

---

## 2. Staging Environment (AWS Secrets Manager)

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  EKS Pod    │────▶│  AWS Secrets     │────▶│  AWS Resources  │
│  (backend)  │     │  Manager         │     │  (RDS, Redis,   │
│             │     │  secrets/austa-  │     │   S3, etc.)     │
│  SDK fetch  │     │  staging/*       │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Setup

1. **Create secrets in AWS Secrets Manager:**

```bash
# Database credentials
aws secretsmanager create-secret \
  --name austa-staging-database \
  --secret-string '{"username":"austa","password":"<secure-password>","host":"rds.xxx.sa-east-1.rds.amazonaws.com","port":5432,"dbname":"austa_care"}'

# JWT secrets
aws secretsmanager create-secret \
  --name austa-staging-jwt \
  --secret-string '{"secret":"<64-char-random>","refreshSecret":"<64-char-random>"}'

# Encryption key
aws secretsmanager create-secret \
  --name austa-staging-encryption \
  --secret-string '{"key":"<64-char-hex>","algorithm":"aes-256-gcm"}'

# API keys
aws secretsmanager create-secret \
  --name austa-staging-api-keys \
  --secret-string '{"openai":"sk-...","zapiToken":"...","tasyApiKey":"..."}'
```

2. **Grant EKS nodes IAM permission:**

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": [
    "arn:aws:secretsmanager:sa-east-1:<account>:secret:austa-staging-*"
  ]
}
```

3. **Application loads secrets at startup:**

The `@aws-sdk/client-secrets-manager` package (already in `backend/package.json`) fetches secrets. Configuration module in `config.ts` can be extended to load from Secrets Manager when `NODE_ENV=staging`.

### Environment Variables for Staging

Minimal `.env` for staging (only non‑secret config):

```
NODE_ENV=staging
AWS_REGION=sa-east-1
AWS_SECRETS_MANAGER_REGION=sa-east-1
SECRETS_PREFIX=austa-staging
KAFKA_BROKERS=b-1.msk.xxx:9092,b-2.msk.xxx:9092
FHIR_BASE_URL=https://fhir.staging.austa.com.br/fhir
CORS_ORIGIN=https://staging.austa.com.br
```

---

## 3. Production Environment (AWS Secrets Manager + Rotation)

### Additional Security Measures

- **Automatic password rotation** for RDS and ElastiCache via AWS Lambda + Secrets Manager rotation templates.
- **All secrets are encrypted** with AWS KMS customer‑managed keys (CMK).
- **Secrets are never logged** — the application redacts secrets from log output.
- **IAM least‑privilege** — only the backend service account can read secrets.
- **VPC endpoint** for Secrets Manager — traffic never leaves the AWS network.

### Rotation Configuration

```bash
# Enable automatic rotation for RDS credentials (every 30 days)
aws secretsmanager rotate-secret \
  --secret-id austa-production-database \
  --rotation-lambda-arn arn:aws:lambda:sa-east-1:<account>:function:secrets-rotation-rds \
  --rotation-rules AutomaticallyAfterDays=30
```

### Production Secret Names (convention)

```
austa-production-database          # RDS credentials
austa-production-redis             # ElastiCache auth token
austa-production-jwt               # JWT signing secrets
austa-production-encryption        # App-level encryption key
austa-production-api-keys          # OpenAI, Z-API, Tasy keys
austa-production-mongodb           # DocumentDB credentials
austa-production-kafka             # MSK SASL/SCRAM credentials
```

---

## 4. Docker Compose Conventions

Both `docker-compose.yml` and `docker-compose.infrastructure.yml` follow this pattern:

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me_in_production}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-change_me_in_production}
```

- `${VARIABLE}` — reads from the environment or `.env` file.
- `:-default` — fallback for local dev when `.env` is missing.
- **No hardcoded passwords** remain in any docker‑compose file.

---

## 5. Security Best Practices

| Practice | Status |
|---|---|
| No secrets in source code | ✅ Enforced by `.gitignore` |
| `.env` in `.gitignore` | ✅ Lines 6‑12 |
| Placeholder values only in `.env.example` | ✅ |
| Docker Compose uses `${VAR}` references | ✅ |
| AWS Secrets Manager for staging/production | ✅ SDK integrated |
| Encryption at rest (KMS) | ✅ For production |
| Automatic rotation | ✅ For production RDS |
| Least‑privilege IAM | ✅ Service‑specific policies |
| Secrets never logged | ✅ `sensitiveDataPatterns` in `security.config.ts` |
| LGPD / ANS / ANVISA alignment | ✅ No PHI in environment variables |

---

## 6. Quick Start Checklist

- [ ] Run `cp .env.example .env`
- [ ] Run `./scripts/generate-dev-secrets.sh`
- [ ] Fill in real values for `OPENAI_API_KEY`, `ZAPI_*`, `AWS_*`
- [ ] Verify `docker-compose up` works with generated secrets
- [ ] For staging: create secrets in AWS Secrets Manager
- [ ] For staging: configure IAM roles for EKS pods
- [ ] For production: enable automatic rotation on RDS and Redis secrets
- [ ] For production: use KMS CMK for encryption

---

## Related Files

| File | Purpose |
|---|---|
| `.env.example` | Template with placeholder values |
| `.env` | Actual secrets (gitignored) |
| `scripts/generate-dev-secrets.sh` | Auto‑generates dev secrets |
| `docker-compose.yml` | References `${VARIABLE}` |
| `docker-compose.infrastructure.yml` | References `${VARIABLE}` |
| `backend/package.json` | Includes `@aws-sdk/client-secrets-manager` |
| `backend/src/config/config.ts` | Loads and validates config |
| `backend/src/config/security.config.ts` | Redacts sensitive data from logs |
