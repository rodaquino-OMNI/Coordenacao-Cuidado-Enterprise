# Monitoring and Configuration System

## Overview

The AUSTA Care Platform includes a comprehensive Prometheus metrics system and environment-based configuration management with secrets handling.

## Table of Contents

- [Prometheus Metrics](#prometheus-metrics)
- [Configuration Management](#configuration-management)
- [Secrets Management](#secrets-management)
- [Environment Setup](#environment-setup)
- [Monitoring Dashboard](#monitoring-dashboard)

---

## Prometheus Metrics

### Available Metrics

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_in_progress` - Current active requests
- `http_request_size_bytes` - Request payload sizes
- `http_response_size_bytes` - Response payload sizes

#### Business Metrics
- `conversations_total` - Total conversations by type, channel
- `conversations_active` - Active conversations gauge
- `messages_processed_total` - Messages processed counter
- `authorizations_total` - Authorization requests by type, status
- `authorization_duration_seconds` - Authorization processing time

#### AI/ML Metrics
- `ai_predictions_total` - AI predictions by model, type, status
- `ai_prediction_duration_seconds` - Prediction latency
- `ai_model_accuracy` - Model accuracy gauge
- `ai_tokens_used_total` - Token consumption

#### Health Metrics
- `health_risk_scores_calculated_total` - Risk assessments
- `health_alerts_generated_total` - Health alerts by severity
- `patient_engagement_score` - Engagement score by segment

#### Integration Metrics
- `whatsapp_messages_total` - WhatsApp messages by direction, type
- `whatsapp_message_latency_seconds` - WhatsApp delivery latency
- `tasy_api_calls_total` - Tasy EHR API calls
- `fhir_operations_total` - FHIR operations by resource

#### Infrastructure Metrics
- `kafka_produced_messages_total` - Kafka producer metrics
- `kafka_consumed_messages_total` - Kafka consumer metrics
- `kafka_consumer_lag` - Consumer lag by topic, partition
- `redis_operations_total` - Redis operations counter
- `redis_latency_seconds` - Redis operation latency
- `mongo_operations_total` - MongoDB operations
- `mongo_latency_seconds` - MongoDB operation latency

#### Error Metrics
- `errors_total` - Application errors by type, severity
- `unhandled_exceptions_total` - Unhandled exceptions
- `validation_errors_total` - Validation errors by entity

#### Performance Metrics
- `nodejs_event_loop_lag_seconds` - Event loop lag
- `nodejs_memory_usage_bytes` - Memory usage by type
- `nodejs_cpu_usage_percentage` - CPU usage
- `nodejs_gc_duration_seconds` - Garbage collection duration

### Accessing Metrics

Metrics are exposed at: `http://localhost:3000/metrics`

```bash
curl http://localhost:3000/metrics
```

### Using Metrics Middleware

The metrics middleware automatically tracks all HTTP requests:

```typescript
import { metricsMiddleware, errorMetricsMiddleware } from './middleware/metrics.middleware';

app.use(metricsMiddleware);
app.use(errorMetricsMiddleware);
```

### Custom Metrics

#### Business Metrics
```typescript
import { metrics } from './infrastructure/monitoring/prometheus.metrics';

// Record business event
metrics.recordBusinessMetric('conversation_started', {
  type: 'health_assessment',
  channel: 'whatsapp',
  status: 'active'
});
```

#### AI Predictions
```typescript
metrics.recordAIPrediction('gpt-4', 'symptom_analysis', duration, true, tokensUsed);
```

#### Infrastructure Operations
```typescript
import { createMetricTimer } from './middleware/metrics.middleware';

const timer = createMetricTimer('redis', 'get', { operation: 'cache_read' });
// ... perform operation
timer.end(true); // true = success
```

### Prometheus Queries

Example queries for monitoring:

```promql
# HTTP error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active conversations by channel
sum(conversations_active) by (channel)

# Kafka consumer lag alert
kafka_consumer_lag > 1000

# Memory usage percentage
(nodejs_memory_usage_bytes{type="heapUsed"} / nodejs_memory_usage_bytes{type="heapTotal"}) * 100
```

---

## Configuration Management

### Environment-Based Configuration

The system supports three environments with specific configurations:

#### Development
- Debug logging enabled
- Lower security requirements
- Standalone Redis/Kafka
- More lenient rate limits
- All features enabled for testing

#### Staging
- Production-like setup
- Cluster mode enabled
- SSL/TLS required
- AWS Secrets Manager integration
- Realistic rate limits

#### Production
- Strict security requirements
- Cluster mode required
- All secrets from AWS Secrets Manager
- Optimized for performance
- Minimal logging overhead

### Configuration Structure

```
backend/src/config/
├── config.ts                    # Main config loader
├── validation.schema.ts         # Joi validation schemas
├── environments/
│   ├── development.ts          # Dev-specific config
│   ├── staging.ts              # Staging-specific config
│   └── production.ts           # Prod-specific config
└── secrets/
    └── secrets.service.ts      # Secrets management
```

### Using Configuration

```typescript
import { config } from './config/config';

// Access configuration
const port = config.port;
const dbUrl = config.database.url;
const kafkaBrokers = config.kafka.brokers;

// Environment-specific features
if (config.features.gamification) {
  // Enable gamification features
}
```

### Validation

All environment variables are validated using Joi schemas:

```typescript
// Automatic validation on startup
const { error, value } = validateEnv(process.env);

if (error) {
  console.error('Configuration validation failed:', error.details);
  process.exit(1);
}
```

---

## Secrets Management

### AWS Secrets Manager Integration

For staging and production environments:

```typescript
import { secretsService } from './config/secrets/secrets.service';

// Get secret from AWS Secrets Manager
const dbPassword = await secretsService.getSecret('database/password');

// Get multiple secrets
const secrets = await secretsService.getSecrets([
  'database/password',
  'jwt/secret',
  'openai/api-key'
]);

// Encrypt sensitive data
const encrypted = secretsService.encrypt('sensitive-value');

// Decrypt data
const decrypted = secretsService.decrypt(encrypted);
```

### Local Development Secrets

For development, secrets are read from `.env` file:

```bash
cp .env.example .env
# Edit .env with your local values
```

### Secret Rotation

```typescript
// Rotate a secret (clears cache)
await secretsService.rotateSecret('database/password', newPassword);

// Clear all cached secrets
secretsService.clearCache();

// Set cache TTL (default: 5 minutes)
secretsService.setCacheTTL(600000); // 10 minutes
```

### Health Check

```typescript
const health = await secretsService.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   details: {
//     cacheSize: 5,
//     awsEnabled: true,
//     awsStatus: 'connected'
//   }
// }
```

---

## Environment Setup

### Development Setup

1. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

2. **Configure local services**
   ```bash
   # Start PostgreSQL
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

   # Start MongoDB
   docker run -d -p 27017:27017 mongo:7

   # Start Redis
   docker run -d -p 6379:6379 redis:7-alpine

   # Start Kafka
   docker-compose up -d kafka
   ```

3. **Set required secrets in .env**
   ```env
   JWT_SECRET=your_local_jwt_secret_minimum_32_characters
   ENCRYPTION_KEY=your_local_encryption_key_minimum_32_chars
   OPENAI_API_KEY=sk-your_openai_key
   # ... other secrets
   ```

4. **Run migrations**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start server**
   ```bash
   npm run dev
   ```

### Staging/Production Setup

1. **Configure AWS Secrets Manager**
   ```bash
   # Create secrets in AWS Secrets Manager
   aws secretsmanager create-secret \
     --name austa-care/staging/database/url \
     --secret-string "postgresql://..."

   aws secretsmanager create-secret \
     --name austa-care/staging/jwt/secret \
     --secret-string "your-64-char-secret"
   ```

2. **Set environment variables**
   ```bash
   export NODE_ENV=staging
   export AWS_REGION=us-east-1
   export AWS_ACCESS_KEY_ID=AKIA...
   export AWS_SECRET_ACCESS_KEY=...
   ```

3. **Deploy with secrets loading**
   ```bash
   npm run build
   npm start
   ```

### Required Environment Variables

See [.env.example](../.env.example) for complete list.

**Critical secrets (must be set):**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key (min 32 chars, 64 in production)
- `JWT_REFRESH_SECRET` - Refresh token key
- `ENCRYPTION_KEY` - Data encryption key
- `OPENAI_API_KEY` - OpenAI API access
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `ZAPI_TOKEN` - WhatsApp integration
- `TASY_API_KEY` - Tasy EHR integration

---

## Monitoring Dashboard

### Grafana Setup

1. **Add Prometheus data source**
   - URL: `http://prometheus:9090`
   - Scrape interval: 15s

2. **Import dashboards**
   - HTTP Metrics Dashboard
   - Business Metrics Dashboard
   - Infrastructure Dashboard
   - Error Tracking Dashboard

### Alerting Rules

Recommended Prometheus alerting rules:

```yaml
groups:
  - name: austa_care_alerts
    rules:
      # High error rate
      - alert: HighHTTPErrorRate
        expr: sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP error rate detected"

      # Kafka consumer lag
      - alert: KafkaConsumerLag
        expr: kafka_consumer_lag > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Kafka consumer lag exceeds threshold"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (nodejs_memory_usage_bytes{type="heapUsed"} / nodejs_memory_usage_bytes{type="heapTotal"}) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"

      # Event loop lag
      - alert: EventLoopLag
        expr: nodejs_event_loop_lag_seconds > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Event loop lag detected"
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'austa-care-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
```

---

## Best Practices

### Metrics
1. Use appropriate metric types (counter, gauge, histogram)
2. Add meaningful labels for filtering
3. Don't create high-cardinality label values
4. Monitor metric cardinality
5. Set appropriate histogram buckets

### Configuration
1. Never commit secrets to git
2. Use environment-specific configs
3. Validate all configuration at startup
4. Document required vs optional variables
5. Use strong secrets in production (64+ chars)

### Secrets
1. Use AWS Secrets Manager for staging/production
2. Rotate secrets regularly
3. Enable secret versioning
4. Monitor secret access
5. Use least-privilege IAM policies

### Monitoring
1. Set up alerting for critical metrics
2. Monitor error rates and latencies
3. Track business KPIs
4. Use dashboards for visualization
5. Review metrics regularly

---

## Troubleshooting

### Metrics Not Appearing

1. Check metrics endpoint: `curl http://localhost:3000/metrics`
2. Verify middleware is loaded
3. Check Prometheus scrape config
4. Review server logs for errors

### Configuration Validation Errors

```bash
# Check environment variables
npm run dev

# Review validation errors in logs
# Fix issues in .env file
```

### Secrets Loading Issues

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test secret access
aws secretsmanager get-secret-value --secret-id austa-care/staging/database/url

# Verify IAM permissions
```

### High Memory Usage

```bash
# Check heap snapshots
node --inspect dist/server.js

# Monitor metrics
curl http://localhost:3000/metrics | grep memory

# Increase memory limit if needed
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
