# AUSTA Care Platform — Developer Guide

> **Última atualização**: 2026-06-27  
> **Status**: Alpha / Pre-Production  
> **Stack**: Node.js 20+, TypeScript 5, Express 4, Prisma 5, PostgreSQL 15, Redis 7

---

## 1. Prerequisites

| Ferramenta | Versão Mínima | Instalação |
|-----------|---------------|-----------|
| Node.js | 20.0.0 | [nodejs.org](https://nodejs.org) ou `nvm install 20` |
| npm | 9.0.0+ | Incluso no Node.js |
| Docker | 24+ | [docker.com](https://docker.com) |
| Docker Compose | 2+ | Incluso no Docker Desktop |
| PostgreSQL | 15 | Via Docker (recomendado) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

### Contas de Serviço Necessárias

- **Z-API** (WhatsApp): [z-api.io](https://z-api.io) — gateway brasileiro de WhatsApp
- **OpenAI**: [platform.openai.com](https://platform.openai.com) — API key para GPT-4

---

## 2. Quick Start

```bash
# 1. Clone o repositório
git clone git@github.com:austa-health/austa-care-platform.git
cd Coordenacao-Cuidado-Enterprise

# 2. Copie e configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (Z-API, OpenAI, etc.)
# Ou gere secrets de desenvolvimento:
bash scripts/generate-dev-secrets.sh

# 3. Inicie infraestrutura (PostgreSQL + Redis)
docker compose up -d postgres redis

# 4. Aguarde PostgreSQL estar pronto
docker compose logs postgres | grep "ready to accept connections"

# 5. Instale dependências
cd austa-care-platform/backend
npm install

# 6. Gere o Prisma Client
npx prisma generate

# 7. Execute as migrações do banco
npx prisma migrate dev

# 8. (Opcional) Popular banco com dados de desenvolvimento
npx tsx prisma/seed/development.ts

# 9. Inicie o servidor de desenvolvimento
npm run dev

# Servidor disponível em http://localhost:3000
```

### Verificação rápida
```bash
curl -s http://localhost:3000/health | jq .status
# Deve retornar: "healthy"

# Ou verificar o health completo
curl -s http://localhost:3000/api/v1/health | jq .
```

### Tudo com Docker Compose (alternativa)

```bash
# Subir tudo (backend + postgres + redis) com um comando
docker compose up -d

# Verificar logs
docker compose logs backend -f
```

---

## 3. Project Structure

```
Coordenacao-Cuidado-Enterprise/
│
├── austa-care-platform/
│   ├── backend/                       ← Monolith TypeScript/Express
│   │   ├── src/
│   │   │   ├── app.ts                 ← Express app setup (helmet, cors, routes)
│   │   │   ├── server.ts              ← Entrypoint (listen, graceful shutdown)
│   │   │   ├── config/                ← Database, Redis, env config
│   │   │   │   ├── database.ts        ← Prisma client singleton
│   │   │   │   └── config.ts          ← Environment config loader
│   │   │   ├── routes/                ← Route definitions (15 route files)
│   │   │   │   ├── index.ts           ← Aggregates all routes under /api/v1
│   │   │   │   ├── health.ts          ← Health check routes
│   │   │   │   ├── auth.routes.ts     ← Authentication routes
│   │   │   │   ├── clinical.routes.ts ← Clinical algorithms & risk assessment
│   │   │   │   ├── gamification.routes.ts ← Gamification system
│   │   │   │   ├── whatsapp.routes.ts ← WhatsApp webhooks & messaging
│   │   │   │   ├── user.routes.ts     ← User management
│   │   │   │   ├── authorization.ts   ← ANS authorization workflows
│   │   │   │   ├── advanced-risk.ts   ← Advanced risk assessment
│   │   │   │   ├── conversation.routes.ts ← Patient conversations
│   │   │   │   ├── document.routes.ts ← Document management
│   │   │   │   ├── health-data.routes.ts ← Health data endpoints
│   │   │   │   ├── ocr.routes.ts      ← OCR processing
│   │   │   │   ├── ai.ts             ← AI service routes
│   │   │   │   └── admin.routes.ts    ← Admin endpoints
│   │   │   ├── services/              ← Business logic
│   │   │   │   ├── whatsapp.service.ts
│   │   │   │   ├── risk-assessment.service.ts
│   │   │   │   ├── emergency-detection.service.ts
│   │   │   │   ├── temporal-risk-tracking.service.ts
│   │   │   │   ├── webhook-processor.service.ts
│   │   │   │   ├── workflowOrchestrator.ts
│   │   │   │   ├── openaiService.ts
│   │   │   │   ├── redisService.ts
│   │   │   │   └── ocr/ (sub-module)
│   │   │   ├── middleware/            ← Express middleware
│   │   │   │   ├── auth.ts            ← JWT + role-based authentication
│   │   │   │   ├── validation.ts      ← Zod/Joi request validation
│   │   │   │   ├── rateLimiter.ts     ← Rate limiting
│   │   │   │   └── error-handler.ts   ← Global error handler
│   │   │   ├── validation/            ← Validation schemas
│   │   │   │   ├── index.ts
│   │   │   │   ├── middleware/
│   │   │   │   └── schemas/
│   │   │   ├── types/                 ← TypeScript type definitions
│   │   │   │   ├── index.ts
│   │   │   │   ├── core/              ← Core types (API response, branded, enums)
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── whatsapp.types.ts
│   │   │   │   ├── risk.types.ts
│   │   │   │   └── ...
│   │   │   ├── infrastructure/        ← Infrastructure clients (aspiracional)
│   │   │   │   ├── redis/
│   │   │   │   ├── kafka/
│   │   │   │   └── ...
│   │   │   └── utils/                 ← Utilities
│   │   │       ├── logger.ts          ← Winston logger
│   │   │       ├── webhook.ts
│   │   │       └── ...
│   │   ├── tests/
│   │   │   ├── unit/                  ← Unit tests (Jest)
│   │   │   ├── integration/           ← Integration tests
│   │   │   ├── e2e/                   ← End-to-end tests
│   │   │   ├── performance/           ← Load tests
│   │   │   ├── helpers/               ← Test factories & fixtures
│   │   │   └── setup.ts               ← Jest global setup
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← Database schema (45+ tables)
│   │   │   ├── migrations/            ← Migration files
│   │   │   └── seed/                  ← Seed data
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                      ← React 18 + Vite 5 SPA
│
├── docs/                              ← Documentation
│   ├── api/
│   │   ├── openapi.yaml               ← OpenAPI 3.0 specification
│   │   └── README.md
│   ├── OPERATIONS-RUNBOOK.md
│   ├── DEVELOPER-GUIDE.md             ← This file
│   ├── architecture/
│   │   └── adr/                       ← 6 Architecture Decision Records
│   ├── HEALTHCARE-INVARIANTS.md
│   ├── SECRETS-MANAGEMENT.md
│   └── WHATSAPP-INTEGRATION.md
│
├── docker-compose.yml                 ← Dev services (postgres, redis, backend)
├── docker-compose.infrastructure.yml  ← Optional services
├── scripts/
│   └── generate-dev-secrets.sh
└── .env.example                       ← Environment variables template
```

### 3.1 Route Mounting

Routes are mounted in `src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { healthRoutes } from './health';
import { authRoutes } from './auth.routes';
import { clinicalRoutes } from './clinical.routes';
import gamificationRoutes from './gamification.routes';
import whatsappRoutes from './whatsapp.routes';

const router = Router();

router.use('/health', healthRoutes);            // → /api/v1/health/*
router.use('/auth', authRoutes);                // → /api/v1/auth/*
router.use('/clinical', clinicalRoutes);        // → /api/v1/clinical/*
router.use('/gamification', gamificationRoutes);// → /api/v1/gamification/*
router.use('/webhooks/whatsapp', whatsappRoutes);// → /api/v1/webhooks/whatsapp/*

export const routes = router;
```

---

## 4. Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript → JavaScript (dist/) |
| `npm start` | Run compiled version (production) |
| `npm test` | Run all tests (Jest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run type-check` | TypeScript type checking (no emit) |
| `npm run validate` | Full validation: type-check + lint + test |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Prisma db push (no migrations) |
| `npm run db:seed` | Seed database with dev data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:backup` | Backup database (pg_dump) |
| `npm run db:reset` | Reset database + re-seed |

---

## 5. How to Run Tests

### 5.1 Unit Tests

```bash
# All unit tests
npx jest tests/unit

# Specific file
npx jest tests/unit/controllers/auth.test.ts

# Watch mode
npx jest tests/unit --watch

# With coverage
npx jest tests/unit --coverage
```

### 5.2 Integration Tests

```bash
# Requires PostgreSQL running
docker compose up -d postgres

# Run integration tests
npx jest tests/integration
```

### 5.3 E2E Tests

```bash
# Requires all services running
docker compose up -d postgres redis
npm run dev &
npx jest tests/e2e
```

### 5.4 Coverage Report

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

---

## 6. Code Conventions

### 6.1 TypeScript — Strict Mode

`tsconfig.json` uses `"strict": true`. This enables all strict checks.

**Rules**:
- Always declare explicit types for function parameters
- Use `unknown` instead of `any` whenever possible
- Prefer `interface` for object shapes, `type` for unions/utilities
- Use branded types for entity IDs: `type UserId = string & { readonly __brand: 'UserId' }`

### 6.2 ESLint

```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

Key rules:
- No unused variables (except `_` prefix)
- No `console.log` — use Winston logger
- Prefer `const` over `let`
- Explicit return types on exported functions

### 6.3 Prettier

```bash
npm run format
```

Configuration:
- Single quotes
- Trailing commas
- 2 spaces indent
- 100 char print width
- Semicolons

### 6.4 Validation

Use **Zod** for request validation:

```typescript
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/login',
  validateRequest(LoginSchema),
  async (req, res) => { /* handler */ }
);
```

### 6.5 Logging

Use the Winston logger — NEVER `console.log()`:

```typescript
import { logger } from '../utils/logger';

logger.info('User registered', { userId: user.id });
logger.warn('Auth failed', { path: req.path, ip: req.ip });
logger.error('DB connection failed', { error: err.message });
```

### 6.6 Error Handling

```typescript
// In route handlers:
try {
  // ... logic
} catch (error) {
  logger.error('Operation failed', { error });
  res.status(500).json({
    error: { code: 'OPERATION_FAILED', message: 'Description' }
  });
}
```

The global error handler (`middleware/error-handler.ts`) catches unhandled errors:

```json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "..." },
  "timestamp": "2026-06-27T...",
  "path": "/api/v1/...",
  "method": "GET"
}
```

### 6.7 Authentication & Authorization

```typescript
import { authenticateToken, requireRole } from '../middleware/auth';

// Require authentication
router.use(authenticateToken);

// Role-based access
router.get('/admin-only', requireRole('admin'), handler);
router.get('/multi-role', requireRole(['admin', 'compliance']), handler);
```

### 6.8 Database Access

Use **Prisma** for all database operations — NEVER write raw SQL except in health checks:

```typescript
import { prisma } from '../config/database';

const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { healthPoints: true }
});
```

---

## 7. How to Add a New Route

### Step-by-step

1. **Create the route file** in `src/routes/`:

```typescript
// src/routes/my-feature.routes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

const MySchema = z.object({
  name: z.string().min(1),
});

router.get('/', authenticateToken, async (req, res) => {
  // Implementation
  res.json({ data: [] });
});

router.post('/', authenticateToken, validateRequest(MySchema), async (req, res) => {
  // Implementation
  res.status(201).json({ data: req.body });
});

export const myFeatureRoutes = router;
```

2. **Register the route** in `src/routes/index.ts`:

```typescript
import { myFeatureRoutes } from './my-feature.routes';

// Add:
router.use('/my-feature', myFeatureRoutes);
```

3. **Add to OpenAPI spec** in `docs/api/openapi.yaml`.

4. **Write tests** in `tests/unit/` and `tests/integration/`.

### Route conventions

- Use plural nouns for resource routes: `/users`, `/documents`
- Use kebab-case for multi-word routes: `/health-data`, `/risk-assessment`
- Path params use camelCase: `/:userId`, `/:documentId`
- Auth required by default — explicitly set `security: []` for public routes
- Return appropriate HTTP status codes:
  - `200` — Success (GET, PUT, PATCH)
  - `201` — Created (POST)
  - `204` — No Content (DELETE)
  - `400` — Bad Request
  - `401` — Unauthorized
  - `403` — Forbidden
  - `404` — Not Found
  - `500` — Internal Server Error

---

## 8. How to Create a Database Migration

### Schema-First Approach

1. **Edit `prisma/schema.prisma`**:

```prisma
model NewFeature {
  id          String   @id @default(uuid())
  name        String
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

2. **Create the migration**:

```bash
npx prisma migrate dev --name add-new-feature
```

3. **Regenerate Prisma Client**:

```bash
npx prisma generate
```

4. **(Optional) Create seed data** in `prisma/seed/development.ts`.

5. **Never edit existing migrations** — always create new ones.

### Migration Best Practices

- Migrations should be small and focused
- Always test migrations locally before merging
- Add `@map` and `@@map` for table/column names to follow PostgreSQL conventions
- Use `@@index` for frequently queried columns
- Use `@default(uuid())` for all primary keys

---

## 9. Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development`, `production` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/austa_care` |
| `JWT_SECRET` | JWT signing secret (64 chars) | Generated by script |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Generated by script |

### WhatsApp (Z-API)

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PROVIDER` | Provider — currently `z-api` |
| `WHATSAPP_API_URL` | Z-API base URL |
| `WHATSAPP_INSTANCE_ID` | Z-API instance ID |
| `WHATSAPP_TOKEN` | Z-API auth token |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |

### AI / OpenAI

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (sk-...) |

### Database & Cache

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `REDIS_URL` | Redis connection URL |
| `REDIS_PASSWORD` | Redis password |

### Security

| Variable | Description |
|----------|-------------|
| `AUDIT_ENCRYPTION_KEY` | Encryption key for audit logs (32 byte hex) |
| `DEAD_MANS_SWITCH_THRESHOLD_MS` | Dead man's switch stale threshold (default: `300000`) |

### Optional

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `AWS_REGION` | AWS region (`sa-east-1`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `TASY_API_URL` | Tasy ERP integration URL |
| `TASY_CLIENT_ID` | Tasy client ID |
| `TASY_CLIENT_SECRET` | Tasy client secret |

### Generating Development Secrets

```bash
bash scripts/generate-dev-secrets.sh
```

This generates a `.env` with random secure values for local development.

---

## 10. Contributing Workflow

```bash
# 1. Update from main
git checkout main
git pull origin main

# 2. Create branch
git checkout -b feature/my-feature
# or: fix/bug-description, docs/what-changed

# 3. Develop (TDD recommended)
# Write test → see it fail → implement → see it pass
npm run test:watch

# 4. Check code quality
npm run lint
npm run format
npm run type-check

# 5. Run all tests
npm test

# 6. Commit (conventional commits)
git add .
git commit -m "feat: add new feature description"

# 7. Push and open PR
git push origin feature/my-feature
```

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     New feature
fix:      Bug fix
docs:     Documentation
refactor: Code restructuring
test:     Test changes
chore:    Build/tooling
perf:     Performance improvement
ci:       CI/CD changes
security: Security fix
```

### PR Checklist

Before opening a PR:
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)
- [ ] No decrease in coverage
- [ ] Documentation updated (OpenAPI, README if needed)
- [ ] Commits follow conventional commits
- [ ] No hardcoded secrets
- [ ] Branch up to date with `main`

---

**🏥 AUSTA Care Platform — Developer Guide | Junho 2026 | Alpha/Pre-Production**
