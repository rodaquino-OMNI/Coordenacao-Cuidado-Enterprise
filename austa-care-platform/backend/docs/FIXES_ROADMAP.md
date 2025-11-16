# Production Readiness Roadmap - AUSTA Care Platform
**Current Status:** 70% Ready
**Target:** 95% Ready for Production
**Estimated Effort:** 20-24 hours

---

## CRITICAL PATH TO PRODUCTION

### Phase 1: Server Stability (4 hours) - BLOCKING

#### 1.1 Add Global Error Handlers (1 hour)
**Priority:** CRITICAL
**Impact:** Prevents server crashes

**File:** `/backend/src/server.ts`

```typescript
// Add at the top of server.ts, before any service initialization

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: String(promise)
  });
  // Don't crash - continue serving requests
  // In production, you might want to trigger alerts here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  // For uncaught exceptions, might want to gracefully shutdown
  // For now, log and continue
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  await shutdownGracefully();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown');
  await shutdownGracefully();
});

async function shutdownGracefully() {
  try {
    // Close server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    // Close database
    await prisma.$disconnect();
    logger.info('Database disconnected');

    // Close Redis (if connected)
    try {
      await redisClient.quit();
      logger.info('Redis disconnected');
    } catch (e) {
      logger.warn('Redis already disconnected');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}
```

**Testing:**
```bash
npm run dev
# Should NOT crash even with Redis/Kafka unavailable
curl http://localhost:3000/health
# Should respond with degraded status
```

---

#### 1.2 Make External Services Optional (2 hours)
**Priority:** CRITICAL
**Impact:** Server runs without Redis/Kafka/TensorFlow

##### Redis Service (`/backend/src/services/redisService.ts`)

```typescript
import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.warn('Redis max reconnection attempts reached');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 1000, 5000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.warn('Redis client error (non-critical)', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      await this.client.connect();
      logger.info('Redis initialized successfully');
    } catch (error: any) {
      logger.warn('Redis unavailable, running without cache', {
        error: error.message
      });
      this.client = null;
      this.isConnected = false;
      // Don't throw - allow server to continue
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) {
      logger.debug('Redis unavailable, cache miss');
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error: any) {
      logger.warn('Redis get failed', { key, error: error.message });
      return null; // Graceful degradation
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      logger.debug('Redis unavailable, skipping cache set');
      return;
    }

    try {
      if (expirySeconds) {
        await this.client.setEx(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error: any) {
      logger.warn('Redis set failed (non-critical)', {
        key,
        error: error.message
      });
      // Don't throw - caching is optional
    }
  }

  // Fix type definition
  getClient(): RedisClientType | null {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export default new RedisService();
```

##### Kafka Service (Optional - Make Gracefully Degradable)

**File:** `/backend/src/services/kafkaService.ts`

```typescript
// Wrap all Kafka initialization in try-catch
async initKafka() {
  if (!process.env.KAFKA_ENABLED || process.env.KAFKA_ENABLED === 'false') {
    logger.info('Kafka disabled via environment variable');
    return;
  }

  try {
    // Existing Kafka initialization
    this.kafka = new Kafka({
      clientId: 'austa-care-platform',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      connectionTimeout: 5000,
      requestTimeout: 5000
    });

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.isConnected = true;
    logger.info('Kafka connected successfully');
  } catch (error: any) {
    logger.warn('Kafka unavailable, event streaming disabled', {
      error: error.message
    });
    this.isConnected = false;
    // Don't throw - allow server to continue without Kafka
  }
}
```

##### TensorFlow (Remove or Make Optional)

**Option A: Remove TensorFlow Entirely (Recommended if not using ML)**
```bash
cd /backend
npm uninstall @tensorflow/tfjs-node
# Remove all TensorFlow imports from codebase
```

**Option B: Make TensorFlow Optional**
```typescript
// In any file using TensorFlow
let tf: any = null;

try {
  tf = require('@tensorflow/tfjs-node');
  logger.info('TensorFlow loaded successfully');
} catch (error) {
  logger.warn('TensorFlow unavailable, ML features disabled');
}

// Then use conditional checks
if (tf) {
  // Use TensorFlow
} else {
  // Fallback to non-ML logic
}
```

**Testing:**
```bash
# Stop all external services
docker stop redis kafka || true

# Start server
npm run dev

# Should start successfully with warnings
# Health endpoint should respond with "degraded" status
curl http://localhost:3000/health/detailed
```

---

#### 1.3 Implement Health Checks with Service Status (1 hour)
**Priority:** CRITICAL
**Impact:** Monitoring knows which services are down

**File:** `/backend/src/controllers/health.controller.ts`

```typescript
export const getDetailedHealth = async (req: Request, res: Response) => {
  try {
    const services = {
      database: await checkDatabase(),
      redis: checkRedis(),
      kafka: checkKafka(),
      tensorflow: checkTensorFlow()
    };

    const allHealthy = Object.values(services).every(s => s.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    res.json({
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services
    });
  } catch (error: any) {
    logger.error('Detailed health check error', { error });
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      message: error.message
    });
  }
};

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', message: 'Connected' };
  } catch (error: any) {
    return { status: 'unhealthy', message: error.message };
  }
}

function checkRedis() {
  if (redisClient.isHealthy()) {
    return { status: 'healthy', message: 'Connected' };
  }
  return { status: 'degraded', message: 'Unavailable (non-critical)' };
}

function checkKafka() {
  if (kafkaService.isConnected) {
    return { status: 'healthy', message: 'Connected' };
  }
  return { status: 'degraded', message: 'Unavailable (non-critical)' };
}

function checkTensorFlow() {
  try {
    require.resolve('@tensorflow/tfjs-node');
    return { status: 'healthy', message: 'Loaded' };
  } catch {
    return { status: 'degraded', message: 'Unavailable (ML features disabled)' };
  }
}
```

---

### Phase 2: Authentication Implementation (8 hours) - BLOCKING

#### 2.1 Implement User Registration (3 hours)
**Priority:** CRITICAL
**Impact:** +3 passing tests, users can register

**File:** `/backend/src/controllers/auth.controller.ts`

```typescript
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { generateTokens } from '../utils/jwt';

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const register = async (req: Request, res: Response) => {
  try {
    // Validate input
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash: hashedPassword,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        emailVerified: false,
        phoneVerified: false
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }

    logger.error('Registration error', { error });
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};
```

**Database Migration Needed:**
```prisma
// In schema.prisma - Add if missing
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  phone         String    @unique
  passwordHash  String    // Add this field
  firstName     String
  lastName      String
  emailVerified Boolean   @default(false)
  phoneVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

```bash
npx prisma migrate dev --name add-auth-fields
npx prisma generate
```

---

#### 2.2 Implement Token Refresh (2 hours)
**Priority:** CRITICAL
**Impact:** +2 passing tests

**File:** `/backend/src/controllers/auth.controller.ts`

```typescript
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if token exists in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found'
      });
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id }
      });

      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokens(tokenRecord.userId);

    // Update refresh token in database
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    logger.info('Token refreshed', { userId: tokenRecord.userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error: any) {
    logger.error('Token refresh error', { error });
    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
};
```

**Create JWT Utils:** `/backend/src/utils/jwt.ts`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';

export function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
}
```

---

#### 2.3 Implement Login with Password Verification (3 hours)
**Priority:** CRITICAL
**Impact:** Users can login

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        emailVerified: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn('Failed login attempt', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }

    logger.error('Login error', { error });
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};
```

**Install Dependencies:**
```bash
cd /backend
npm install bcrypt @types/bcrypt jsonwebtoken @types/jsonwebtoken zod
```

---

### Phase 3: TypeScript Type Fixes (4 hours) - HIGH PRIORITY

#### 3.1 Fix WhatsApp Service Types (1 hour)

**File:** `/backend/tests/unit/services/whatsapp.service.test.ts`

```typescript
// Fix optional chaining for config
const config = (whatsappService as any).getAxiosConfig?.();
expect(config?.timeout).toBe(30000);
expect(config?.headers?.['Content-Type']).toBe('application/json');

// Update QRCodeResponse interface
interface QRCodeResponse {
  qrcode: string;
  expiresAt: Date;
  // ... other properties
}
```

---

#### 3.2 Fix Risk Assessment Types (2 hours)

**File:** `/backend/tests/unit/services/risk-assessment.service.test.ts`

```typescript
// Update test factory with complete types
function createMockQuestionnaire(options: Partial<ProcessedQuestionnaire> = {}): ProcessedQuestionnaire {
  return {
    id: options.id || 'test-id',
    userId: options.userId || 'user-123',
    timestamp: options.timestamp || new Date(),
    extractedSymptoms: (options.symptoms || []).map(s => ({
      symptom: s,
      severity: 'moderate',
      duration: '2 days',
      confidence: 0.8,
      frequency: 'daily',           // Added
      associatedSymptoms: [],       // Added
      medicalRelevance: 'moderate'  // Added
    })),
    riskFactors: (options.riskFactors || []).map(rf => ({
      factor: rf,
      severity: 'high',
      confidence: 0.9,
      value: 'present',             // Added
      significance: 'high',         // Added
      medicalConditions: [],        // Added
      evidenceLevel: 'confirmed'    // Added
    })),
    responses: (options.responses || []).map(r => ({
      question: r,
      answer: 'yes',
      timestamp: new Date(),
      questionId: `q-${Math.random()}`,  // Added
      type: 'boolean',                   // Added
      medicalRelevance: 'moderate'       // Added
    })),
    ...options
  };
}
```

---

#### 3.3 Fix Database Test Types (30 min)

**File:** `/backend/tests/unit/models/database.test.ts`

```typescript
import { PrismaPromise } from '@prisma/client';

// Add type annotations
prisma.$transaction.mockImplementation(async <T>(
  operations: PrismaPromise<T>[]
) => {
  const results = await Promise.all(operations.map((op: PrismaPromise<T>) => op));
  return results as T[];
});
```

---

#### 3.4 Fix WhatsApp Controller Template Literal (30 min)

**File:** `/backend/tests/unit/controllers/whatsapp.test.ts`

```typescript
// Fix malformed template literal
expect(logger.info).toHaveBeenCalledWith(
  'WhatsApp webhook verification',
  { mode: 'subscribe', token: verifyToken }
);
```

---

### Phase 4: Business Logic Fixes (2 hours) - MEDIUM PRIORITY

#### 4.1 Fix Ketosis Detection (1 hour)

**File:** `/backend/src/services/emergency-detection.service.ts`

```typescript
// Adjust ketosis detection threshold
private detectDiabeticEmergencies(assessment: RiskAssessment): EmergencyAlert[] {
  const alerts: EmergencyAlert[] = [];
  const glucose = assessment.metrics.glucose;
  const ketonesInUrine = assessment.questionnaire?.ketonesInUrine;

  // ... existing DKA and severe hyperglycemia detection

  // Ketosis risk - ADJUSTED THRESHOLD
  if (
    (glucose && glucose > 180) && // Lowered from 250
    (ketonesInUrine === 'moderate' || ketonesInUrine === 'high') &&
    (assessment.symptoms?.includes('nausea') || assessment.symptoms?.includes('vomiting'))
  ) {
    alerts.push({
      type: 'medical',
      severity: 'warning', // Changed from critical
      condition: 'Risco de Cetose',
      timeToAction: '2-4 hours',
      // ... rest of alert
    });
  }

  return alerts;
}
```

---

#### 4.2 Fix Multiple Conditions Severity (30 min)

```typescript
// Review severity hierarchy - ensure consistency
const SEVERITY_ORDER = ['immediate', 'critical', 'warning', 'info'];

// When multiple conditions detected:
if (criticalConditions.length > 1) {
  return {
    severity: 'critical', // Not immediate
    condition: `Múltiplas Condições Críticas (${criticalConditions.length})`,
    // ...
  };
}
```

---

#### 4.3 Fix Webhook Array Sanitization (30 min)

**File:** `/backend/src/utils/webhook.ts`

```typescript
export function sanitizeWebhookPayload(payload: any): any {
  if (payload === null || payload === undefined) {
    return payload;
  }

  // Handle arrays - recurse on each element
  if (Array.isArray(payload)) {
    return payload.map(item => sanitizeWebhookPayload(item));
  }

  // Handle primitives
  if (typeof payload !== 'object') {
    return payload;
  }

  // Handle objects
  const sanitized: any = {};
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'api_key', 'access_token', 'refresh_token'
  ];

  for (const [key, value] of Object.entries(payload)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeWebhookPayload(value); // Recurse
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

---

### Phase 5: Import/Export Fixes (1 hour) - MEDIUM PRIORITY

#### 5.1 Fix E2E Test Imports

**File:** `/backend/tests/e2e/auth-flow.e2e.test.ts`

```typescript
// Change named import to default import
import app from '../../src/server'; // Fixed

// For password checks, select explicitly
const user = await prisma.user.findUnique({
  where: { email: userData.email },
  select: {
    id: true,
    email: true,
    passwordHash: true // Explicit selection
  }
});

expect(user!.passwordHash).not.toBe(userData.password);
expect(user!.passwordHash.length).toBeGreaterThan(20);
```

---

### Phase 6: Documentation & Environment Setup (1 hour)

#### 6.1 Create .env.example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/austa_care"

# JWT Secrets
JWT_SECRET="your-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"

# External Services (Optional)
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="false"  # Set to true when Redis is available

KAFKA_BROKER="localhost:9092"
KAFKA_ENABLED="false"  # Set to true when Kafka is available

# TensorFlow
TENSORFLOW_ENABLED="false"  # Set to true if ML features needed

# WhatsApp
WHATSAPP_API_TOKEN="your-whatsapp-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_VERIFY_TOKEN="your-verify-token"
WHATSAPP_WEBHOOK_SECRET="your-webhook-secret"

# Environment
NODE_ENV="development"
PORT=3000
LOG_LEVEL="info"
```

---

## TESTING CHECKLIST

### After Each Phase:

```bash
# Run tests
npm run test

# Check server starts
npm run dev
# Verify: Server starts without crashes
# Verify: Health endpoint responds

# Check specific functionality
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phone":"+5511999999999","password":"Test123!"}'

# Should return 201 Created

curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Should return 200 OK with tokens
```

---

## FINAL VALIDATION

### Before Deployment:

1. **All Critical Tests Pass**
   ```bash
   npm run test
   # Expected: 0 failed, 114 passed
   ```

2. **Server Starts Clean**
   ```bash
   npm run dev
   # No crashes, only INFO/WARN logs for unavailable services
   ```

3. **Health Checks Work**
   ```bash
   curl http://localhost:3000/health
   # Returns: status 200, degraded/healthy
   ```

4. **Auth Flow Works**
   ```bash
   # Register → Login → Refresh Token
   # All return expected status codes (201, 200, 200)
   ```

5. **TypeScript Compiles**
   ```bash
   npm run typecheck
   # 0 errors
   ```

6. **Build Succeeds**
   ```bash
   npm run build
   # Successful compilation
   ```

---

## SUCCESS CRITERIA

- [ ] Server starts without crashes (graceful degradation)
- [ ] 95%+ test pass rate (108/114 tests)
- [ ] Auth endpoints functional (register, login, refresh)
- [ ] Health checks report service status accurately
- [ ] TypeScript compilation with 0 errors
- [ ] All external services optional (Redis, Kafka, TensorFlow)
- [ ] Comprehensive error handling (no unhandled rejections)
- [ ] Production-ready logging
- [ ] Environment variables documented

---

**Estimated Total Effort:** 20 hours
**Critical Path:** 12 hours (Phases 1-2)
**Nice-to-Have:** 8 hours (Phases 3-6)

**Deployment Readiness After Completion:** 95%
