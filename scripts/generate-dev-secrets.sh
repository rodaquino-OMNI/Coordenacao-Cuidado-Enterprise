#!/bin/bash
# ==========================================
# AUSTA Care Platform
# Generate safe random secrets for local development
# ==========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE already exists."
  echo "Delete it first if you want to regenerate:"
  echo "  rm $ENV_FILE"
  exit 1
fi

echo ""
echo "=========================================="
echo " AUSTA Care — Dev Secrets Generator"
echo "=========================================="
echo ""

# Detect OpenSSL (macOS vs Linux)
if command -v openssl &> /dev/null; then
  RAND_HEX_16="openssl rand -hex 16"
  RAND_HEX_32="openssl rand -hex 32"
  RAND_HEX_8="openssl rand -hex 8"
elif command -v xxd &> /dev/null; then
  RAND_HEX_16="head -c 16 /dev/urandom | xxd -p -c 16"
  RAND_HEX_32="head -c 32 /dev/urandom | xxd -p -c 32"
  RAND_HEX_8="head -c 8 /dev/urandom | xxd -p -c 8"
else
  echo "ERROR: openssl or xxd required to generate random secrets."
  exit 1
fi

cat > "$ENV_FILE" << EOF
# ==========================================
# Auto-generated dev secrets — DO NOT COMMIT
# ==========================================
# Generated: $(date)
#
# For staging/production, use AWS Secrets Manager instead.
# See: docs/SECRETS-MANAGEMENT.md
# ==========================================

# ----- Database (PostgreSQL) -----
DATABASE_URL=postgresql://austa_user:dev_$($RAND_HEX_16)@localhost:5432/austa_care
POSTGRES_USER=austa_user
POSTGRES_PASSWORD=dev_$($RAND_HEX_16)
POSTGRES_DB=austa_care

# ----- Redis -----
REDIS_URL=redis://:dev_$($RAND_HEX_8)@localhost:6379
REDIS_PASSWORD=dev_$($RAND_HEX_8)

# ----- JWT -----
JWT_SECRET=$($RAND_HEX_32)
JWT_REFRESH_SECRET=$($RAND_HEX_32)

# ----- Audit -----
AUDIT_ENCRYPTION_KEY=$($RAND_HEX_16)

# ----- MongoDB -----
MONGO_INITDB_ROOT_USERNAME=austa
MONGO_INITDB_ROOT_PASSWORD=dev_$($RAND_HEX_16)
MONGO_INITDB_DATABASE=austa_care

# ----- MinIO -----
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=dev_$($RAND_HEX_16)

# ----- Grafana -----
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=dev_$($RAND_HEX_16)

# ----- PGAdmin -----
PGADMIN_DEFAULT_EMAIL=admin@austa.com
PGADMIN_DEFAULT_PASSWORD=dev_$($RAND_HEX_16)

# ----- Non-secret defaults (dev) -----
NODE_ENV=development
PORT=3000
AWS_REGION=sa-east-1
WHATSAPP_PROVIDER=z-api
LOG_LEVEL=debug

# ----- External API keys (fill manually) -----
WHATSAPP_API_URL=https://api.z-api.io
WHATSAPP_INSTANCE_ID=
WHATSAPP_TOKEN=
OPENAI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
TASY_API_URL=
TASY_CLIENT_ID=
TASY_CLIENT_SECRET=

EOF

echo ""
echo "=========================================="
echo " ✅ .env generated with random secrets"
echo "=========================================="
echo ""
echo "External API keys were left empty — fill them manually:"
echo "  WHATSAPP_INSTANCE_ID"
echo "  WHATSAPP_TOKEN"
echo "  OPENAI_API_KEY"
echo "  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY"
echo "  TASY_CLIENT_ID / TASY_CLIENT_SECRET"
echo ""
echo "CRITICAL: This file is ignored by Git (.gitignore)."
echo "          NEVER commit .env files."
echo ""
