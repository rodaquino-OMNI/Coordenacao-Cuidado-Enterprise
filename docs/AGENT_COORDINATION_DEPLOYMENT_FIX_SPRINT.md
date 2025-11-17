# AGENT COORDINATION PROMPT: DEPLOYMENT FIX SPRINT

**Mission:** Fix all deployment blockers in remote environment and achieve verified production-ready status
**Session ID:** `deploy-fix-sprint-2025-11-17`
**Environment:** Remote container (Docker not available)
**Policy:** ZERO TRUST - Verify every claim with actual command execution
**Working Directory:** `/home/user/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend`

---

## CRITICAL: ZERO TRUST VERIFICATION POLICY

**MANDATORY VERIFICATION PROTOCOL:**

1. **NEVER claim success without running the actual command**
2. **ALWAYS include command output as evidence**
3. **ALWAYS verify prerequisites exist before proceeding**
4. **ALWAYS test after every fix**
5. **ONLY mark tasks complete after verification passes**

**Example of CORRECT verification:**
```
Step: Install dependencies
Action: Run "npm install --legacy-peer-deps"
Verify: Run "npm list --depth=0 | grep -v UNMET"
Evidence: [paste actual output showing packages installed]
Status: ✅ VERIFIED - Dependencies installed
```

**Example of INCORRECT (DO NOT DO THIS):**
```
Step: Install dependencies
Action: Updated package.json to fix conflicts
Status: ✅ Complete (assuming install will work)
```

---

## DIAGNOSTIC SUMMARY - VERIFIED CURRENT STATE

### Environment Capabilities
- ✅ Node.js v22.21.1 available
- ✅ npm 10.9.4 available
- ✅ npx available
- ❌ Docker NOT available (cannot start infrastructure services)
- ❌ Claude-flow requires installation via npx
- ✅ Git available
- ✅ File system read/write access

### Current Blockers (Evidence-Based)

**P0 - CRITICAL BLOCKERS:**

1. **Dependencies Not Installed**
   - Evidence: `npm list` shows "UNMET DEPENDENCY" for all 90+ packages
   - Evidence: `ls -la node_modules` returns "No such file or directory"
   - Impact: Cannot compile, test, or run application

2. **MongoDB Version Conflict**
   - Evidence: package.json specifies `"mongodb": "^6.3.0"`
   - Evidence: `@langchain/community@0.0.29` requires `mongodb@^5.2.0`
   - Evidence: `npm install` fails with "ERESOLVE could not resolve"
   - Impact: Blocks dependency installation

3. **Sharp Library Download Failure**
   - Evidence: `npm install` output shows "sharp: Installation error: Status 403 Forbidden"
   - Evidence: Error message indicates proxy blocking libvips download
   - Impact: Blocks dependency installation

4. **Memory Leaks in Code**
   - Location 1: `/backend/src/utils/webhook.ts:273`
     - Evidence: Global `setInterval()` without cleanup mechanism
     - Evidence: No corresponding `clearInterval()` call anywhere in codebase
   - Location 2: `/backend/src/services/openaiService.ts:113`
     - Evidence: Instance method `setInterval()` without cleanup
     - Evidence: No shutdown method to clear interval
   - Impact: Memory accumulation over time, Jest cannot exit cleanly

5. **Missing Environment Files**
   - Evidence: `ls .env*` shows "No such file or directory"
   - Evidence: Only `.env.example` exists
   - Impact: Server cannot start without configuration

**P1 - HIGH PRIORITY:**

6. **TypeScript Compilation Status Unknown**
   - Evidence: `npx tsc --noEmit` shows only "Cannot find type definition file for 'jest'" and 'node'
   - Note: Cannot verify full compilation until dependencies installed
   - Impact: Unknown number of type errors blocking build

7. **Test Execution Blocked**
   - Evidence: `npm test` fails with "jest: not found"
   - Evidence: No node_modules directory exists
   - Impact: Cannot verify test coverage or quality

8. **Infrastructure Services Unavailable**
   - Evidence: `docker ps` returns "docker: command not found"
   - Services needed: PostgreSQL (5432), Redis (6379), MongoDB (27017), Kafka (9092)
   - Impact: Full end-to-end testing requires local environment (SPRINT 2)

---

## MCP MEMORY PERSISTENCE ARCHITECTURE

### Memory Namespace Structure

**Session Memory:** `memory/swarm/deploy-fix-sprint-2025-11-17/`

**Agent Memory Keys:**
```
memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/status
memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/dependency-graph
memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/blockers
memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/verification-log

memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/npm-install-log
memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/conflict-resolution
memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/verification-evidence

memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/memory-leaks-fixed
memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/typescript-errors
memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/files-modified

memory/swarm/deploy-fix-sprint-2025-11-17/env-configurator/files-created
memory/swarm/deploy-fix-sprint-2025-11-17/env-configurator/variables-set

memory/swarm/deploy-fix-sprint-2025-11-17/tester/test-results
memory/swarm/deploy-fix-sprint-2025-11-17/tester/coverage-report
memory/swarm/deploy-fix-sprint-2025-11-17/tester/failures-analysis

memory/swarm/deploy-fix-sprint-2025-11-17/build-validator/compilation-log
memory/swarm/deploy-fix-sprint-2025-11-17/build-validator/build-success

memory/swarm/deploy-fix-sprint-2025-11-17/final-verifier/deployment-readiness
memory/swarm/deploy-fix-sprint-2025-11-17/final-verifier/evidence-package
```

### Memory Usage Protocol

**Every agent MUST:**
1. Store ALL command outputs in memory immediately after execution
2. Store verification evidence under their memory key
3. Read coordinator dependency-graph before starting work
4. Update coordinator status after completing each task
5. Store failure logs if verification fails

**Memory Persistence Commands:**
```bash
# Store verification evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/agent-name/task-name" "$(cat evidence.log)"

# Retrieve status from another agent
npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/verification-evidence"

# List all agent outputs
npx claude-flow@alpha memory list-namespace "memory/swarm/deploy-fix-sprint-2025-11-17"
```

---

## AGENT ROLES AND RESPONSIBILITIES

### 1. COORDINATOR AGENT (Queen)
**Role:** Central intelligence, dependency tracking, verification oversight
**Agent Type:** `queen-coordinator`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/`

**Responsibilities:**
- Initialize swarm coordination topology
- Create and maintain dependency graph for all tasks
- Monitor all agent verification outputs
- Identify blocking dependencies
- Coordinate parallel vs sequential execution
- Aggregate final verification evidence
- Generate deployment readiness report

**Coordination Hooks:**
```bash
# Before any work starts
npx claude-flow@alpha hooks pre-task --description "Deployment Fix Sprint Initialization"
npx claude-flow@alpha swarm init --topology mesh --max-agents 6 --session-id "deploy-fix-sprint-2025-11-17"

# Store dependency graph
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/dependency-graph" "[JSON dependency structure]"

# After sprint completes
npx claude-flow@alpha hooks post-task --task-id "deploy-fix-sprint-2025-11-17"
npx claude-flow@alpha hooks session-end --export-metrics true
```

### 2. DEPENDENCY FIXER AGENT
**Role:** Resolve npm dependency conflicts and install all packages
**Agent Type:** `coder`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/`

**Tasks:**
1. Fix MongoDB version conflict between package.json and @langchain/community
2. Fix Sharp library installation failure
3. Install all dependencies successfully
4. Verify installation with zero UNMET dependencies

**Verification Commands (MANDATORY):**
```bash
# After EVERY change, run:
npm install --legacy-peer-deps 2>&1 | tee install.log
npm list --depth=0 2>&1 | grep -c "UNMET DEPENDENCY" # MUST return 0
ls -la node_modules | wc -l # MUST return >100 packages

# Store evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/verification-evidence" "$(cat install.log)"
```

**Success Criteria:**
- [ ] `npm list --depth=0` shows ZERO "UNMET DEPENDENCY" entries
- [ ] `node_modules` directory exists with 600+ subdirectories
- [ ] No errors in npm install output
- [ ] Evidence stored in memory

### 3. CODE FIXER AGENT
**Role:** Fix memory leaks and TypeScript compilation errors
**Agent Type:** `coder`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/`

**Tasks:**
1. Fix memory leak in webhook.ts line 273
2. Fix memory leak in openaiService.ts line 113
3. Fix all TypeScript compilation errors
4. Verify zero compilation errors

**Specific Fixes Required:**

**Fix 1: webhook.ts Memory Leak**
- Add cleanup interval tracking variable
- Export cleanup function
- Ensure interval can be cleared on shutdown

**Fix 2: openaiService.ts Memory Leak**
- Add private interval tracking property
- Create public shutdown method
- Clear interval in shutdown method

**Verification Commands (MANDATORY):**
```bash
# After EVERY code change, run:
cd /home/user/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend
npx tsc --noEmit 2>&1 | tee compilation.log
cat compilation.log | grep -c "error TS" # MUST return 0

# Verify memory leak fixes exist
grep -n "clearInterval" src/utils/webhook.ts # MUST show cleanup code
grep -n "shutdown.*clearInterval" src/services/openaiService.ts # MUST show cleanup method

# Store evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/typescript-errors" "$(cat compilation.log)"
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/code-fixer/memory-leaks-fixed" "$(grep -A3 -B3 clearInterval src/utils/webhook.ts src/services/openaiService.ts)"
```

**Success Criteria:**
- [ ] `npx tsc --noEmit` shows ZERO errors
- [ ] Both memory leaks have cleanup mechanisms
- [ ] Code includes shutdown/cleanup functions
- [ ] Evidence stored in memory

### 4. ENVIRONMENT CONFIGURATOR AGENT
**Role:** Create environment configuration files
**Agent Type:** `coder`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/env-configurator/`

**Tasks:**
1. Create `.env.development` from `.env.example`
2. Set all required environment variables for remote testing
3. Generate secure secrets where needed
4. Verify all critical variables are set

**Environment Variables Required:**
- DATABASE_URL (can use mock connection string for remote)
- JWT_SECRET (generate 64-character random string)
- JWT_REFRESH_SECRET (generate 64-character random string)
- OPENAI_API_KEY (set to "test-key-not-for-production")
- ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_WEBHOOK_SECRET (test values)
- All other variables from .env.example with safe test values

**Verification Commands (MANDATORY):**
```bash
# After creating .env files:
ls -la .env.development # MUST exist
cat .env.development | grep -c "=" # MUST return >50 (number of variables)
cat .env.development | grep "JWT_SECRET" | wc -c # MUST return >70 (64-char secret + variable name)
cat .env.development | grep "your-" # MUST return EMPTY (no placeholder values)

# Store evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/env-configurator/files-created" "$(ls -la .env*)"
```

**Success Criteria:**
- [ ] `.env.development` exists
- [ ] All variables have non-placeholder values
- [ ] JWT secrets are 64+ characters
- [ ] No "your-" placeholder strings remain
- [ ] Evidence stored in memory

### 5. TESTER AGENT
**Role:** Run tests, achieve coverage, fix failures
**Agent Type:** `tester`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/tester/`

**Tasks:**
1. Run full test suite
2. Analyze all test failures
3. Fix failing tests
4. Achieve minimum 80% test coverage
5. Verify all tests pass

**Verification Commands (MANDATORY):**
```bash
# Run tests with coverage
npm test -- --coverage --passWithNoTests 2>&1 | tee test-results.log

# Extract metrics
cat test-results.log | grep "Test Suites:"
cat test-results.log | grep "Tests:"
cat test-results.log | grep -A4 "Coverage summary"

# Verify pass rate
cat test-results.log | grep -E "Tests:.*passed" # MUST show high pass count
cat test-results.log | grep -E "failed.*0" # MUST show 0 or very low failures

# Store evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/tester/test-results" "$(cat test-results.log)"
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/tester/coverage-report" "$(cat test-results.log | grep -A10 'Coverage summary')"
```

**Success Criteria:**
- [ ] Test pass rate ≥ 95%
- [ ] Test coverage ≥ 80% (statements, branches, functions, lines)
- [ ] Zero critical test failures
- [ ] Evidence stored in memory

### 6. BUILD VALIDATOR AGENT
**Role:** Verify production build succeeds
**Agent Type:** `coder`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/build-validator/`

**Tasks:**
1. Run production build
2. Verify build output exists
3. Check build size and structure
4. Verify no build warnings or errors

**Verification Commands (MANDATORY):**
```bash
# Run build
npm run build 2>&1 | tee build.log

# Verify output
ls -lah dist/ # MUST exist with compiled files
cat build.log | grep -i "error" # MUST return EMPTY
cat build.log | grep -i "compiled successfully" # MUST show success message

# Store evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/build-validator/compilation-log" "$(cat build.log)"
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/build-validator/build-success" "$(ls -lah dist/)"
```

**Success Criteria:**
- [ ] Build completes without errors
- [ ] `dist/` directory exists with compiled JavaScript
- [ ] No TypeScript errors in build output
- [ ] Evidence stored in memory

### 7. FINAL VERIFIER AGENT
**Role:** Comprehensive end-to-end verification and report generation
**Agent Type:** `production-validator`
**Memory Key:** `memory/swarm/deploy-fix-sprint-2025-11-17/final-verifier/`

**Tasks:**
1. Retrieve all agent verification evidence from memory
2. Re-run all critical verification commands
3. Generate comprehensive deployment readiness report
4. Identify any remaining issues for Sprint 2 (local environment)

**Verification Commands (MANDATORY):**
```bash
# Re-verify EVERYTHING
cd /home/user/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend

# Dependencies
npm list --depth=0 | grep -c "UNMET" # MUST = 0

# Compilation
npx tsc --noEmit 2>&1 | grep -c "error TS" # MUST = 0

# Tests
npm test -- --passWithNoTests --coverage 2>&1 | grep "Test Suites:"

# Build
npm run build 2>&1 | grep -i "success"

# Memory leaks fixed
grep -c "clearInterval" src/utils/webhook.ts src/services/openaiService.ts # MUST ≥ 2

# Environment
ls -la .env.development # MUST exist

# Retrieve all agent evidence
npx claude-flow@alpha memory list-namespace "memory/swarm/deploy-fix-sprint-2025-11-17"

# Store final report
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/final-verifier/deployment-readiness" "$(cat final-verification-report.md)"
```

**Success Criteria:**
- [ ] ALL previous agent verifications re-confirmed
- [ ] Comprehensive report generated with evidence
- [ ] Deployment readiness percentage calculated
- [ ] Sprint 2 tasks identified (if needed)
- [ ] Evidence package stored in memory

---

## DEPENDENCY GRAPH AND EXECUTION PLAN

### Dependency Graph (JSON Structure)

```json
{
  "tasks": {
    "T1_COORDINATOR_INIT": {
      "agent": "coordinator",
      "dependencies": [],
      "parallel_group": 1,
      "estimated_time": "2min"
    },
    "T2_FIX_DEPENDENCIES": {
      "agent": "dependency-fixer",
      "dependencies": ["T1_COORDINATOR_INIT"],
      "parallel_group": 2,
      "estimated_time": "10-20min",
      "blocking": true
    },
    "T3_FIX_CODE": {
      "agent": "code-fixer",
      "dependencies": ["T2_FIX_DEPENDENCIES"],
      "parallel_group": 3,
      "estimated_time": "30-60min",
      "blocking": true
    },
    "T4_CREATE_ENV": {
      "agent": "env-configurator",
      "dependencies": ["T1_COORDINATOR_INIT"],
      "parallel_group": 2,
      "estimated_time": "5-10min",
      "blocking": false
    },
    "T5_RUN_TESTS": {
      "agent": "tester",
      "dependencies": ["T3_FIX_CODE", "T4_CREATE_ENV"],
      "parallel_group": 4,
      "estimated_time": "15-30min",
      "blocking": true
    },
    "T6_BUILD_VALIDATE": {
      "agent": "build-validator",
      "dependencies": ["T3_FIX_CODE"],
      "parallel_group": 4,
      "estimated_time": "5-10min",
      "blocking": false
    },
    "T7_FINAL_VERIFY": {
      "agent": "final-verifier",
      "dependencies": ["T5_RUN_TESTS", "T6_BUILD_VALIDATE"],
      "parallel_group": 5,
      "estimated_time": "10-15min",
      "blocking": false
    }
  }
}
```

### Execution Batches (Parallel Where Possible)

**BATCH 1 (Parallel: 1 agent)**
- Coordinator initialization and setup

**BATCH 2 (Parallel: 2 agents)**
- Dependency Fixer (BLOCKING - must complete before Batch 3)
- Environment Configurator (non-blocking)

**BATCH 3 (Parallel: 1 agent, waits for T2)**
- Code Fixer (BLOCKING - must complete before Batch 4)

**BATCH 4 (Parallel: 2 agents, wait for T3)**
- Tester (BLOCKING - must complete before Batch 5)
- Build Validator (non-blocking)

**BATCH 5 (Parallel: 1 agent, waits for T5, T6)**
- Final Verifier

### BatchTool Optimization Commands

```bash
# Batch 1: Coordinator
npx claude-flow@alpha agent spawn --type queen-coordinator --batch 1

# Batch 2: Parallel execution
npx claude-flow@alpha agent spawn --type coder --role dependency-fixer --batch 2 --blocking
npx claude-flow@alpha agent spawn --type coder --role env-configurator --batch 2

# Wait for Batch 2 blocking tasks, then Batch 3
npx claude-flow@alpha agent spawn --type coder --role code-fixer --batch 3 --blocking

# Wait for Batch 3, then Batch 4 parallel
npx claude-flow@alpha agent spawn --type tester --batch 4 --blocking
npx claude-flow@alpha agent spawn --type coder --role build-validator --batch 4

# Wait for Batch 4, then Batch 5
npx claude-flow@alpha agent spawn --type production-validator --batch 5
```

---

## COORDINATION HOOK REQUIREMENTS

### Pre-Task Hooks (Every Agent)

```bash
# At agent start
npx claude-flow@alpha hooks pre-task --description "[Agent Role] - [Task Description]"
npx claude-flow@alpha hooks session-restore --session-id "deploy-fix-sprint-2025-11-17"

# Retrieve dependency graph
npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/dependency-graph"

# Retrieve predecessor agent outputs (if dependencies exist)
npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/[predecessor-agent]/verification-evidence"
```

### During-Task Hooks (After Every Significant Action)

```bash
# After running verification command
npx claude-flow@alpha hooks post-edit --file "[file-modified]" --memory-key "memory/swarm/deploy-fix-sprint-2025-11-17/[agent-name]/[task-name]"

# After fixing issue
npx claude-flow@alpha hooks notify --message "[Agent] completed [task]: [verification result]"

# Store verification evidence
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/[agent-name]/[task-name]" "$(cat evidence.log)"
```

### Post-Task Hooks (Every Agent)

```bash
# At agent completion
npx claude-flow@alpha hooks post-task --task-id "deploy-fix-sprint-2025-11-17-[agent-name]"

# Update coordinator status
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/status" "[Agent] completed with [success/failure]: [summary]"

# Store final agent report
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/[agent-name]/final-report" "$(cat final-report.md)"
```

### Session End Hooks (Coordinator Only)

```bash
# Export all metrics
npx claude-flow@alpha hooks session-end --export-metrics true --session-id "deploy-fix-sprint-2025-11-17"

# Archive session memory
npx claude-flow@alpha memory export-namespace "memory/swarm/deploy-fix-sprint-2025-11-17" --output "session-archive.json"
```

---

## CENTRAL COORDINATOR INTELLIGENCE PATTERNS

### Pattern 1: Blocking Task Detection

**Coordinator monitors memory for completion signals:**
```bash
# Check if blocking task completed
STATUS=$(npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/verification-evidence" 2>/dev/null)

if echo "$STATUS" | grep -q "VERIFIED.*Dependencies installed"; then
  echo "✅ T2 Complete - Unblocking T3 (Code Fixer)"
  npx claude-flow@alpha agent spawn --type coder --role code-fixer --batch 3
else
  echo "⏳ T2 Still Running - Code Fixer waiting"
fi
```

### Pattern 2: Failure Detection and Recovery

**Coordinator checks for verification failures:**
```bash
# Monitor for failures
FAILURES=$(npx claude-flow@alpha memory list-namespace "memory/swarm/deploy-fix-sprint-2025-11-17" | grep -c "FAILED")

if [ "$FAILURES" -gt 0 ]; then
  echo "🚨 Failures detected - Coordinator intervention required"
  # Retrieve failure details
  npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/*/verification-evidence" | grep "FAILED"
  # Decision: retry, escalate, or adapt plan
fi
```

### Pattern 3: Progress Aggregation

**Coordinator maintains sprint status:**
```bash
# Aggregate all agent statuses
echo "Sprint Progress:" > sprint-status.md
for AGENT in coordinator dependency-fixer code-fixer env-configurator tester build-validator final-verifier; do
  STATUS=$(npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/$AGENT/final-report" 2>/dev/null || echo "Not started")
  echo "- $AGENT: $STATUS" >> sprint-status.md
done

# Store aggregated status
npx claude-flow@alpha memory store "memory/swarm/deploy-fix-sprint-2025-11-17/coordinator/aggregated-status" "$(cat sprint-status.md)"
```

### Pattern 4: Adaptive Replanning

**Coordinator adjusts plan based on verification results:**
```bash
# If dependency installation takes multiple attempts
ATTEMPT=1
while [ $ATTEMPT -le 3 ]; do
  RESULT=$(npx claude-flow@alpha memory retrieve "memory/swarm/deploy-fix-sprint-2025-11-17/dependency-fixer/verification-evidence")

  if echo "$RESULT" | grep -q "VERIFIED"; then
    break
  else
    echo "Attempt $ATTEMPT failed - Trying alternative approach"
    ATTEMPT=$((ATTEMPT+1))
    # Coordinator suggests new strategy to dependency-fixer
  fi
done
```

---

## VERIFICATION CHECKLIST (Final Report)

**Final Verifier Agent MUST verify ALL of these:**

### Dependencies
- [ ] `npm list --depth=0` shows ZERO "UNMET DEPENDENCY"
- [ ] `node_modules` directory exists
- [ ] Package count > 600 subdirectories
- [ ] Command output stored in memory

### Code Quality
- [ ] `npx tsc --noEmit` returns ZERO errors
- [ ] Memory leak fixes verified in webhook.ts
- [ ] Memory leak fixes verified in openaiService.ts
- [ ] Shutdown/cleanup functions exist
- [ ] Command output stored in memory

### Environment
- [ ] `.env.development` exists
- [ ] All variables have real values (no "your-" placeholders)
- [ ] JWT secrets are 64+ characters
- [ ] Critical variables verified present
- [ ] File content stored in memory

### Tests
- [ ] Test pass rate ≥ 95%
- [ ] Test coverage ≥ 80% (all metrics)
- [ ] Zero critical failures
- [ ] Coverage report stored in memory

### Build
- [ ] `npm run build` succeeds
- [ ] `dist/` directory exists with compiled files
- [ ] No build errors
- [ ] Build output stored in memory

### Documentation
- [ ] All agent reports generated
- [ ] All evidence stored in memory
- [ ] Final deployment readiness report created
- [ ] Sprint 2 tasks identified (if applicable)

---

## SPRINT 2 SCOPE (Local Environment Only)

**Tasks requiring Docker/infrastructure (deferred to local):**

1. Start Docker infrastructure services
2. Verify PostgreSQL connection and schema
3. Verify Redis connection
4. Verify MongoDB connection
5. Verify Kafka connection
6. Run end-to-end server tests with real infrastructure
7. Test WhatsApp integration with real credentials
8. Test AI features with real OpenAI API
9. Full smoke testing with all services running

**Estimated time for Sprint 2:** 2-4 hours (on local environment with Docker)

---

## SUCCESS METRICS

**Sprint completion criteria:**

1. **Dependencies:** 100% installed, 0 UNMET
2. **Compilation:** 0 TypeScript errors
3. **Code Quality:** 0 memory leaks, all cleanup functions present
4. **Tests:** ≥95% pass rate, ≥80% coverage
5. **Build:** Production build succeeds
6. **Environment:** All config files created with safe values
7. **Verification:** ALL evidence stored in memory
8. **Documentation:** Comprehensive final report generated

**Remote Environment Deployment Readiness Target:** ≥90%
**Full Production Readiness Target (after Sprint 2):** ≥95%

---

## EXECUTION COMMAND

**To execute this sprint:**

```bash
# Initialize coordinator agent with this prompt
# The coordinator will spawn all other agents according to dependency graph
# All agents will follow zero-trust verification policy
# All evidence will be stored in MCP memory
# Final report will aggregate all verification results
```

**Expected total time:** 90-180 minutes
**Expected final status:** Remote environment ready, Sprint 2 identified for local completion

---

## FINAL REMINDERS

1. **VERIFY EVERYTHING** - No assumptions, only evidence
2. **STORE ALL EVIDENCE** - Every command output goes to memory
3. **FOLLOW DEPENDENCIES** - Respect the dependency graph
4. **COORDINATE CONSTANTLY** - Update coordinator memory after each task
5. **PARALLEL WHERE POSSIBLE** - Maximize concurrent execution
6. **SEQUENTIAL WHERE REQUIRED** - Respect blocking dependencies
7. **TEST AFTER EVERY FIX** - Never claim success without verification
8. **DOCUMENT EVERYTHING** - Reports must include evidence, not assumptions

**Zero trust. Maximum verification. Evidence-based deployment readiness.**

---

**END OF AGENT COORDINATION PROMPT**
