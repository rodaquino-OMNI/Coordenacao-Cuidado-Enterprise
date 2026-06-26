# Technical Gap Analysis & Execution Plan — AUSTA Care Platform

> **Date:** 2026-06-26
> **Orchestrator:** Parreira (@Parreirabot)
> **Mode:** Autonomous — zero prompts, max parallelism

---

## Executive Summary

| Area | Current State | Target | Severity |
|------|--------------|--------|----------|
| API Routes | 90 mock implementations across 12 files | Real Prisma queries | 🔴 CRITICAL |
| Docker Backend | `npm install` fails (bullmq/redis peer conflict) | Build succeeds | 🔴 CRITICAL |
| Docker Frontend | `npm ci` fails (no lockfile) | Build succeeds | 🟠 HIGH |
| WhatsApp Wiring | Z-API client real, routes mock | End-to-end WhatsApp flow | 🟠 HIGH |
| Test Coverage | 3% | >50% | 🟡 MEDIUM |
| Test Suites | 11/21 failing | 0 failing | 🟡 MEDIUM |
| ESLint | Not configured | Configured + passing | 🟡 MEDIUM |
| Frontend TypeScript | Not installed as dep | `tsc --noEmit` = 0 | 🟡 MEDIUM |

---

## Wave Plan

```
Wave 0: DOCKER + DEPENDENCIES FIX (2 agents) → commit
Wave 1: WHATSAPP WIRING (3 agents) → commit
Wave 2: ROUTE HARDENING — replace mocks with Prisma (3 agents) → commit
Wave 3: TEST + LINT + COVERAGE (3 agents) → commit
Wave 4: FRONTEND + VERIFICATION (2 agents) → commit
```

---

## Wave 0 — Docker + Dependencies Fix

### Problem
- **Backend**: `bullmq@5.79.1` requires `redis@>=5.0.0` but project uses `redis@4.7.1`. Docker's `npm install` fails with ERESOLVE.
- **Frontend**: No `package-lock.json`, `npm ci` fails. TypeScript not installed.

### Agent 0-A: Fix Backend Docker Build
**Goal:** Make `docker build -t austa-backend:test austa-care-platform/backend` succeed.

**Tasks:**
1. Read `backend/package.json` — find the bullmq and redis version conflict
2. Fix: either upgrade `redis` to `>=5.0.0` (if compatible with code) OR downgrade `bullmq` to match `redis@4.x`
3. Update `backend/Dockerfile` to use `npm install --legacy-peer-deps` as fallback
4. Test: `docker build -t austa-backend:test austa-care-platform/backend 2>&1 | tail -5`

### Agent 0-B: Fix Frontend Docker Build + TypeScript
**Goal:** Make `docker build -t austa-frontend:test austa-care-platform/frontend` succeed.

**Tasks:**
1. Check if `package-lock.json` exists — if not, generate with `npm install`
2. Install TypeScript as devDependency
3. Update Dockerfile to use `npm install` instead of `npm ci` (or generate lockfile first)
4. Test: `docker build -t austa-frontend:test austa-care-platform/frontend 2>&1 | tail -5`

---

## Wave 1 — WhatsApp Wiring

### Problem
WhatsApp webhook receives messages but the pipeline to ConversationFlowEngine → Prisma → WhatsApp reply is incomplete. Several routes use `// Mock implementation`.

### Agent 1-A: Wire WhatsApp Webhook → Conversation → AI → Reply
**Goal:** Complete the end-to-end WhatsApp conversation loop.

**Tasks:**
1. Update `src/controllers/whatsapp.ts` webhook handler to:
   - On message received → create/find `Conversation` in Prisma
   - Store incoming `Message` with `direction: INBOUND`
   - Invoke `ConversationFlowEngine` to determine next node/response
   - Generate AI response via `openaiService` (or persona fallback)
   - Store outgoing `Message` with `direction: OUTBOUND`
   - Send reply via `whatsappService.sendTextMessage()`
2. Remove mock data from webhook handler
3. Verify: webhook POST → conversation created in DB → message persisted → reply sent

### Agent 1-B: Wire Onboarding Flow to Conversation
**Goal:** When a user's onboarding is incomplete, the conversation engine should route to onboarding missions.

**Tasks:**
1. Update `ConversationFlowEngine` to check `hasCompletedOnboarding(userId)`
2. If incomplete → route to first pending `Mission` from `OnboardingProgress`
3. Connect `MissionStep` completion to `OnboardingProgress.currentStep` increment
4. On mission completion → update `OnboardingProgress.status = COMPLETED`, award `pointsEarned`
5. Verify: new user WhatsApp message → onboarding flow triggers → progress updates in DB

### Agent 1-C: Replace Mock Data in WhatsApp Routes
**Goal:** All WhatsApp route handlers use real Z-API client + Prisma.

**Tasks:**
1. `POST /webhooks/whatsapp/send` → call `whatsappService.sendTextMessage()` instead of mock
2. `GET /webhooks/whatsapp/messages` → query `Message` from Prisma instead of mock array
3. `GET /webhooks/whatsapp/templates` → keep mock (Z-API template management is separate)
4. `GET /webhooks/whatsapp/stats` → query real stats from Prisma
5. Verify: each endpoint returns real data from DB or Z-API

---

## Wave 2 — Route Hardening (Replace ALL Mocks with Prisma)

### Agent 2-A: Conversation Routes → Prisma
**Files:** `src/routes/conversation.routes.ts` (14 mock instances)
- `POST /` → `prisma.conversation.create()`
- `GET /` → `prisma.conversation.findMany()` with filters
- `GET /:id` → `prisma.conversation.findUnique()`
- `GET /:id/messages` → `prisma.message.findMany()`
- `POST /:id/messages` → `prisma.message.create()`
- `PATCH /:id/status` → `prisma.conversation.update()`
- `DELETE /:id` → `prisma.conversation.update({status: ARCHIVED})`

### Agent 2-B: Gamification + Health-Data Routes → Prisma
**Files:** `src/routes/gamification.routes.ts`, `src/routes/health-data.routes.ts`
- Mission CRUD → `prisma.mission.*`
- OnboardingProgress → `prisma.onboardingProgress.*`
- HealthData → `prisma.healthData.*`
- PointTransaction → `prisma.pointTransaction.*`

### Agent 2-C: Document + OCR + User Routes → Prisma
**Files:** `src/routes/document.routes.ts`, `src/routes/ocr.routes.ts`, `src/routes/user.routes.ts`
- Document upload/list → `prisma.document.*`
- User profile → `prisma.user.*`

---

## Wave 3 — Test + Lint + Coverage

### Agent 3-A: Fix Remaining 11 Failing Test Suites
**Goal:** All 21 test suites pass (0 failures).

**To fix:**
1. `tests/e2e/` — 3 suites: ESM/Prisma schema issues
2. `tests/integration/api.test.ts` — `uuid` ESM transform issue
3. `tests/performance/load-tests.test.ts` — axios interceptor issue
4. `tests/unit/services/whatsapp*.test.ts` — runtime/behavioral issues
5. `tests/unit/services/risk-assessment.service.test.ts` — 11/38 fail
6. `tests/unit/services/advanced-risk-assessment.test.ts` — 11/19 fail

### Agent 3-B: Configure ESLint + Fix Lint Errors
**Goal:** ESLint configured and passing across the codebase.

**Tasks:**
1. Install ESLint + TypeScript plugin + Prettier
2. Create `.eslintrc.json` with TypeScript rules
3. Run `eslint src/ --fix` 
4. Fix any remaining lint errors

### Agent 3-C: Expand Test Coverage
**Goal:** Increase coverage from 3% to >50%.

**Tasks:**
1. Add unit tests for `lib/crypto.ts`, `lib/retry.ts`, `lib/algorithm-registry.ts`
2. Add tests for `middleware/` (errorHandler, rateLimiter, sanitization)
3. Add tests for `config/database.ts`
4. Verify: `npm test -- --coverage` shows >50% line coverage

---

## Wave 4 — Frontend + Final Verification

### Agent 4-A: Frontend TypeScript + Build
**Goal:** `cd frontend && npm run build` succeeds.

**Tasks:**
1. Install TypeScript as devDependency
2. Run `tsc --noEmit` and fix any errors
3. Run `npm run build` and fix Vite build errors
4. Test: frontend builds to `dist/`

### Agent 4-B: End-to-End Verification
**Goal:** Full verification — all systems green.

**Tasks:**
1. `tsc --noEmit` (backend + frontend) = 0 errors
2. `npm test` = all suites pass
3. `docker build` (backend + frontend) = succeeds
4. `npm run lint` = passes
5. Server starts: `npm run dev` → health check returns 200
6. Update `PROJECT_STATUS.md` with final state
