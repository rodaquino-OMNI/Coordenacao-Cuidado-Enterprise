#!/bin/bash
cd /Users/familia/code/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend

export DATABASE_URL="postgresql://intensicare:intensicare_dev@localhost:5432/austa_care?schema=public"
export REDIS_URL="redis://localhost:6379"
export NODE_ENV="development"
export PORT="3000"
export JWT_SECRET="dev-jwt-secret-key-with-32plus-chars-for-testing"
export JWT_REFRESH_SECRET="dev-refresh-secret-key-with-32plus-chars-here"
export AUDIT_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef"
export ENCRYPTION_KEY="0123456789abcdef0123456789abcdef"
export OPENAI_API_KEY="sk-dev-openai-key-for-local-testing-only"
export ZAPI_BASE_URL="https://api.z-api.io"
export ZAPI_INSTANCE_ID="dev-instance-id-for-local-zapi"
export ZAPI_TOKEN="dev-zapi-token-that-is-at-least-32-chars-long"
export ZAPI_WEBHOOK_VERIFY_TOKEN="dev-webhook-verify-with-enough-chars-to-pass"
export ZAPI_WEBHOOK_SECRET="dev-webhook-secret-also-with-32plus-chars"
export TASY_API_URL="https://dev.tasy.example.com/api"
export TASY_API_KEY="dev-tasy-api-key-for-local-testing-env"
export TASY_API_SECRET="dev-tasy-api-secret-for-local-testing-env"
export WHATSAPP_PROVIDER="z-api"

echo "Starting AUSTA Care Platform..."
npx tsx src/server.ts
