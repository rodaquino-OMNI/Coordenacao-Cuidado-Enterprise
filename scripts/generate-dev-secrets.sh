#!/usr/bin/env bash
# =============================================================================
# AUSTA Care Platform — Development Secrets Generator
# =============================================================================
# Generates strong random secrets for local development and writes them to .env.
#
# Usage:
#   chmod +x scripts/generate-dev-secrets.sh
#   ./scripts/generate-dev-secrets.sh
#
# The generated .env file MUST NOT be committed. It is already in .gitignore.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
EXAMPLE_FILE="$REPO_ROOT/.env.example"

# ---------------------------------------------------------------------------
# Helper: generate a base64 secret of the given byte length
# ---------------------------------------------------------------------------
generate_secret() {
  local bytes="${1:-32}"
  openssl rand -base64 "$bytes" | tr -d '\n' | tr '/+' '_-'
}

# ---------------------------------------------------------------------------
# Helper: generate a hex secret
# ---------------------------------------------------------------------------
generate_hex() {
  local bytes="${1:-32}"
  openssl rand -hex "$bytes"
}

# ---------------------------------------------------------------------------
# Helper: safe sed in-place (macOS / Linux portable)
# ---------------------------------------------------------------------------
safe_sed() {
  local pattern="$1"
  local file="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$pattern" "$file"
  else
    sed -i "$pattern" "$file"
  fi
}

echo "============================================"
echo "  AUSTA Care — Dev Secrets Generator"
echo "============================================"
echo ""

if [[ -f "$ENV_FILE" ]]; then
  echo "[!] .env already exists at $ENV_FILE"
  read -r -p "    Overwrite? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "    Aborted."
    exit 0
  fi
fi

# Start fresh from .env.example
if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "[✗] .env.example not found at $EXAMPLE_FILE — aborting."
  exit 1
fi

cp "$EXAMPLE_FILE" "$ENV_FILE"
echo "[✓] Copied .env.example → .env"

# ---------------------------------------------------------------------------
# Generate secrets
# ---------------------------------------------------------------------------
POSTGRES_PASSWORD=$(generate_secret 32)
MONGO_PASSWORD=$(generate_secret 32)
JWT_SECRET=$(generate_secret 48)
JWT_REFRESH_SECRET=$(generate_secret 48)
ENCRYPTION_KEY=$(generate_hex 32)
MINIO_PASSWORD=$(generate_secret 32)
GRAFANA_PASSWORD=$(generate_secret 32)
PGADMIN_PASSWORD=$(generate_secret 32)
ZAPI_WEBHOOK_SECRET=$(generate_secret 48)
ZAPI_VERIFY_TOKEN=$(generate_secret 32)
OPENAI_API_KEY_PLACEHOLDER="sk-placeholder-$(generate_hex 16)"

echo "[✓] Generated random secrets"

# ---------------------------------------------------------------------------
# Replace placeholders in .env
# ---------------------------------------------------------------------------
safe_sed "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" "$ENV_FILE"
safe_sed "s|^MONGO_INITDB_ROOT_PASSWORD=.*|MONGO_INITDB_ROOT_PASSWORD=$MONGO_PASSWORD|" "$ENV_FILE"
safe_sed "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
safe_sed "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" "$ENV_FILE"
safe_sed "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_FILE"
safe_sed "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_PASSWORD|" "$ENV_FILE"
safe_sed "s|^GF_SECURITY_ADMIN_PASSWORD=.*|GF_SECURITY_ADMIN_PASSWORD=$GRAFANA_PASSWORD|" "$ENV_FILE"
safe_sed "s|^PGADMIN_DEFAULT_PASSWORD=.*|PGADMIN_DEFAULT_PASSWORD=$PGADMIN_PASSWORD|" "$ENV_FILE"
safe_sed "s|^ZAPI_WEBHOOK_SECRET=.*|ZAPI_WEBHOOK_SECRET=$ZAPI_WEBHOOK_SECRET|" "$ENV_FILE"
safe_sed "s|^ZAPI_WEBHOOK_VERIFY_TOKEN=.*|ZAPI_WEBHOOK_VERIFY_TOKEN=$ZAPI_VERIFY_TOKEN|" "$ENV_FILE"
safe_sed "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_API_KEY_PLACEHOLDER|" "$ENV_FILE"

# Patch DATABASE_URL and MONGODB_URI to use the generated passwords
safe_sed "s|change_me_in_production@postgres|$POSTGRES_PASSWORD@postgres|g" "$ENV_FILE"
safe_sed "s|change_me_in_production@mongodb|$MONGO_PASSWORD@mongodb|g" "$ENV_FILE"

echo "[✓] Patched all secrets in .env"
echo ""
echo "============================================"
echo "  ✅  Development .env ready!"
echo "============================================"
echo ""
echo "  Generated secrets for:"
echo "    • PostgreSQL"
echo "    • MongoDB"
echo "    • JWT (access + refresh)"
echo "    • Encryption key"
echo "    • MinIO"
echo "    • Grafana"
echo "    • pgAdmin"
echo "    • WhatsApp Z-API webhook"
echo "    • OpenAI (placeholder — replace with real key)"
echo ""
echo "  ⚠️  REMINDER: .env is gitignored — NEVER commit it."
echo "  ⚠️  Replace OPENAI_API_KEY, ZAPI_INSTANCE_ID, ZAPI_TOKEN with real values."
echo ""
