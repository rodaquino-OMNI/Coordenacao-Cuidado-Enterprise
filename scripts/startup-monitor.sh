#!/bin/bash

# AUSTA Care Platform - Comprehensive Startup Monitor
# Agent: Coder (Hive Mind Swarm)
# Purpose: Monitor application startup with detailed logging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file paths
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/logs"
STARTUP_LOG="$LOG_DIR/startup_${TIMESTAMP}.log"
ERROR_LOG="$LOG_DIR/startup_errors_${TIMESTAMP}.log"
INFRASTRUCTURE_LOG="$LOG_DIR/infrastructure_${TIMESTAMP}.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Initialize logs
echo "=== AUSTA Care Platform Startup Monitor ===" | tee "$STARTUP_LOG"
echo "Timestamp: $(date)" | tee -a "$STARTUP_LOG"
echo "Environment: development" | tee -a "$STARTUP_LOG"
echo "" | tee -a "$STARTUP_LOG"

# Function to log with color
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$STARTUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$STARTUP_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$STARTUP_LOG" | tee -a "$ERROR_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$STARTUP_LOG" | tee -a "$ERROR_LOG"
}

# Check infrastructure services
log_info "Phase 1: Infrastructure Services Check"
echo "=== Infrastructure Services Status ===" | tee "$INFRASTRUCTURE_LOG"

# Check Docker
log_info "Checking Docker daemon..."
if docker ps > /dev/null 2>&1; then
    log_success "Docker is running"
    echo "Docker: Running" >> "$INFRASTRUCTURE_LOG"
else
    log_error "Docker is not running"
    echo "Docker: NOT RUNNING" >> "$INFRASTRUCTURE_LOG"
    echo "ERROR: Docker daemon is not accessible" >> "$ERROR_LOG"
fi

# Check PostgreSQL
log_info "Checking PostgreSQL (port 5432)..."
if lsof -iTCP:5432 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    log_success "PostgreSQL is listening on port 5432"
    echo "PostgreSQL: Running (port 5432)" >> "$INFRASTRUCTURE_LOG"
else
    log_error "PostgreSQL is not running on port 5432"
    echo "PostgreSQL: NOT RUNNING" >> "$INFRASTRUCTURE_LOG"
    echo "ERROR: PostgreSQL not accessible on port 5432" >> "$ERROR_LOG"
fi

# Check Redis
log_info "Checking Redis (port 6379)..."
if redis-cli ping > /dev/null 2>&1; then
    log_success "Redis is responding"
    echo "Redis: Running (port 6379)" >> "$INFRASTRUCTURE_LOG"
else
    log_error "Redis is not responding"
    echo "Redis: NOT RUNNING" >> "$INFRASTRUCTURE_LOG"
    echo "ERROR: Redis not accessible on port 6379" >> "$ERROR_LOG"
fi

# Check Kafka
log_info "Checking Kafka (port 9092)..."
if lsof -iTCP:9092 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    log_success "Kafka is listening on port 9092"
    echo "Kafka: Running (port 9092)" >> "$INFRASTRUCTURE_LOG"
else
    log_error "Kafka is not running on port 9092"
    echo "Kafka: NOT RUNNING" >> "$INFRASTRUCTURE_LOG"
    echo "ERROR: Kafka not accessible on port 9092" >> "$ERROR_LOG"
fi

# Check MongoDB
log_info "Checking MongoDB (port 27017)..."
if lsof -iTCP:27017 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    log_success "MongoDB is listening on port 27017"
    echo "MongoDB: Running (port 27017)" >> "$INFRASTRUCTURE_LOG"
else
    log_error "MongoDB is not running on port 27017"
    echo "MongoDB: NOT RUNNING" >> "$INFRASTRUCTURE_LOG"
    echo "ERROR: MongoDB not accessible on port 27017" >> "$ERROR_LOG"
fi

# Check application ports
log_info "Checking application ports..."
if lsof -iTCP:3000 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    log_warning "Port 3000 (backend) is already in use"
    echo "Backend Port (3000): IN USE" >> "$INFRASTRUCTURE_LOG"
else
    log_success "Port 3000 (backend) is available"
    echo "Backend Port (3000): Available" >> "$INFRASTRUCTURE_LOG"
fi

if lsof -iTCP:5173 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    log_warning "Port 5173 (frontend) is already in use"
    echo "Frontend Port (5173): IN USE" >> "$INFRASTRUCTURE_LOG"
else
    log_success "Port 5173 (frontend) is available"
    echo "Frontend Port (5173): Available" >> "$INFRASTRUCTURE_LOG"
fi

echo "" | tee -a "$STARTUP_LOG"
log_info "Phase 2: Environment Configuration Check"

# Check environment files
BACKEND_ENV="/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/.env.development"
if [ -f "$BACKEND_ENV" ]; then
    log_success "Environment file found: $BACKEND_ENV"

    # Check critical environment variables
    log_info "Validating environment configuration..."

    if grep -q "DATABASE_URL=" "$BACKEND_ENV"; then
        log_success "DATABASE_URL configured"
    else
        log_error "DATABASE_URL not configured"
    fi

    if grep -q "REDIS_URL=" "$BACKEND_ENV"; then
        log_success "REDIS_URL configured"
    else
        log_error "REDIS_URL not configured"
    fi
else
    log_error "Environment file not found: $BACKEND_ENV"
fi

echo "" | tee -a "$STARTUP_LOG"
log_info "Phase 3: Node.js Dependencies Check"

# Check backend dependencies
BACKEND_DIR="/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend"
if [ -d "$BACKEND_DIR/node_modules" ]; then
    log_success "Backend dependencies installed"
    MODULE_COUNT=$(find "$BACKEND_DIR/node_modules" -maxdepth 1 -type d | wc -l)
    log_info "Backend modules count: $MODULE_COUNT"
else
    log_error "Backend node_modules not found - need to run npm install"
fi

# Check frontend dependencies
FRONTEND_DIR="/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/frontend"
if [ -d "$FRONTEND_DIR/node_modules" ]; then
    log_success "Frontend dependencies installed"
else
    log_warning "Frontend node_modules not found - may need npm install"
fi

echo "" | tee -a "$STARTUP_LOG"
log_info "Infrastructure Status Summary:"
cat "$INFRASTRUCTURE_LOG" | tee -a "$STARTUP_LOG"

echo "" | tee -a "$STARTUP_LOG"
if [ -s "$ERROR_LOG" ]; then
    log_warning "Errors detected during infrastructure check"
    log_info "Error summary:"
    cat "$ERROR_LOG" | tee -a "$STARTUP_LOG"
else
    log_success "No infrastructure errors detected"
fi

echo "" | tee -a "$STARTUP_LOG"
log_info "Startup monitor logs saved:"
log_info "  - Main log: $STARTUP_LOG"
log_info "  - Error log: $ERROR_LOG"
log_info "  - Infrastructure log: $INFRASTRUCTURE_LOG"
