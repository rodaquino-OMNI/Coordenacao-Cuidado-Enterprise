#!/bin/bash

# Backend Startup with Error Capture
# Agent: Coder (Hive Mind Swarm)

set +e  # Don't exit on errors, we want to capture them

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/logs"
BACKEND_LOG="$LOG_DIR/backend_startup_${TIMESTAMP}.log"
BACKEND_ERROR_LOG="$LOG_DIR/backend_errors_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo "=== BACKEND STARTUP ATTEMPT ===" | tee "$BACKEND_LOG"
echo "Timestamp: $(date)" | tee -a "$BACKEND_LOG"
echo "Working Directory: $(pwd)" | tee -a "$BACKEND_LOG"
echo "" | tee -a "$BACKEND_LOG"

cd /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend

echo "[INFO] Copying environment file..." | tee -a "$BACKEND_LOG"
cp ../.env.development .env 2>&1 | tee -a "$BACKEND_LOG"

echo "[INFO] Starting backend application..." | tee -a "$BACKEND_LOG"
echo "[INFO] Command: npm run dev" | tee -a "$BACKEND_LOG"
echo "" | tee -a "$BACKEND_LOG"

# Run with timeout and capture all output
timeout 30s npm run dev 2>&1 | tee -a "$BACKEND_LOG" | tee -a "$BACKEND_ERROR_LOG" || {
    EXIT_CODE=$?
    echo "" | tee -a "$BACKEND_LOG"
    echo "[ERROR] Backend startup failed or timed out (exit code: $EXIT_CODE)" | tee -a "$BACKEND_LOG" | tee -a "$BACKEND_ERROR_LOG"
}

echo "" | tee -a "$BACKEND_LOG"
echo "=== ERROR ANALYSIS ===" | tee -a "$BACKEND_LOG"

# Analyze errors
if grep -i "error\|fail\|exception\|refused\|timeout" "$BACKEND_LOG" > /dev/null 2>&1; then
    echo "[ERROR] Connection/initialization errors detected:" | tee -a "$BACKEND_LOG"
    grep -i "error\|fail\|exception\|refused\|timeout" "$BACKEND_LOG" | tee -a "$BACKEND_ERROR_LOG"
else
    echo "[INFO] No obvious errors detected in logs" | tee -a "$BACKEND_LOG"
fi

echo "" | tee -a "$BACKEND_LOG"
echo "Logs saved:" | tee -a "$BACKEND_LOG"
echo "  - Main: $BACKEND_LOG" | tee -a "$BACKEND_LOG"
echo "  - Errors: $BACKEND_ERROR_LOG" | tee -a "$BACKEND_LOG"
