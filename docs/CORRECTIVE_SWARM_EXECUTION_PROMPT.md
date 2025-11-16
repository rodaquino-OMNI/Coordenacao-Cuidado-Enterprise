# 🔧 CORRECTIVE SWARM EXECUTION PROMPT: AUSTA Care 60% → 100%

**CRITICAL MISSION:** Execute the MISSING 40% - **DO NOT JUST DOCUMENT**

**Forensics Analysis:** Platform is at 60% completion (excellent docs, missing execution)
**Problem:** Previous swarm documented work but didn't execute commands
**Solution:** This swarm MUST execute and VERIFY each step

---

## 🚨 MANDATORY EXECUTION PHILOSOPHY

**GOLDEN RULE:** If you can't `curl` it, `cat` it, or `ls` it - **IT DOESN'T EXIST**

### Critical Differences from Previous Swarm

| Previous Swarm (WRONG) | This Swarm (CORRECT) |
|------------------------|----------------------|
| ❌ Document that .env was created | ✅ Actually CREATE .env + verify with `cat` |
| ❌ Write report about npm install | ✅ Actually RUN `npm install` + verify node_modules exists |
| ❌ Explain migration steps | ✅ Actually RUN `npx prisma migrate` + verify in database |
| ❌ Describe frontend build | ✅ Actually BUILD frontend + verify dist/ folder exists |
| ❌ Document health check should work | ✅ Actually START server + `curl localhost:3000/health` returns 200 |

**EVERY TASK REQUIRES:**
1. ✅ Execute the actual command
2. ✅ Verify output/files created
3. ✅ Store verification proof in MCP memory
4. ✅ Test that it actually works

---

## 🎯 CURRENT STATE (From Forensics Analysis)

### ✅ What We Have (Documented but Not Executed)
- ✅ 597-line DevOps report (DEVOPS_DATABASE_SETUP_COMPLETE.md)
- ✅ 482-line Test report (TEST_REPORT.md)
- ✅ 487-line Security audit (PRODUCTION_SECURITY_AUDIT.md)
- ✅ Complete CI/CD pipeline (.github/workflows/ci-cd.yml)
- ✅ Docker compose files (2 files)
- ✅ Kubernetes manifests (23 files)
- ✅ Test code (16 files, 288 tests)
- ✅ Frontend components (25+ files)
- ✅ Deployment guides

### ❌ What We DON'T Have (Missing Execution)
- ❌ Actual .env files (.env.development, .env.staging, .env.production)
- ❌ Installed dependencies (no node_modules/ anywhere)
- ❌ Generated Prisma client (no .prisma/client/)
- ❌ Executed database migrations
- ❌ Loaded seed data
- ❌ Working backend server (tsx missing, won't start)
- ❌ Working frontend build (React deps missing, build fails)
- ❌ Passing test suite (blocked by missing .env)
- ❌ Verified deployment readiness

**Gap:** ~40-45% of deployment-critical work

---

## 🐝 OPTIMIZED SWARM TOPOLOGY (3 Agents + Coordinator)

**Why Only 3 Agents?**
The remaining work is execution-focused, not planning. Smaller swarm = better coordination.

### Central Coordinator (Verification Intelligence)
**Agent ID:** `coordinator-execution-verify`
**Memory Keys:** `austa/verify/*`
**Role:** Verify EVERY claim with actual file checks and command outputs
**Critical Responsibility:** **REJECT** any claim without proof (ls output, curl result, file contents)

### Agent 1: Execution Engineer (CRITICAL PATH)
**Agent ID:** `execution-env-deps`
**Memory Keys:** `austa/execute/env-deps/*`
**Priority:** 🔴 BLOCKER - Nothing works without this
**Dependencies:** NONE (START IMMEDIATELY)

**Tasks:**
1. CREATE actual .env.development (not document, CREATE)
2. CREATE actual .env.staging
3. CREATE actual .env.production
4. RUN `npm install` in backend (verify node_modules/ exists)
5. RUN `npm install` in frontend (verify node_modules/ exists)
6. RUN `npx prisma generate` (verify .prisma/client/ exists)
7. RUN `npx prisma migrate deploy` (verify in database)
8. RUN seed script (verify data in database)

**Verification Requirements:** MUST provide `ls -la` output for EVERY file/folder created

### Agent 2: Verification & Testing Engineer
**Agent ID:** `execution-test-verify`
**Memory Keys:** `austa/execute/testing/*`
**Dependencies:** Agent 1 (needs .env files to run tests)
**Priority:** 🔴 HIGH

**Tasks:**
1. RUN `npm run dev` in backend (verify server starts, no errors)
2. CURL `http://localhost:3000/health` (verify 200 response)
3. RUN `npm run build` in frontend (verify dist/ folder exists)
4. RUN `npm test` in backend (verify tests pass)
5. RUN `npm run test:coverage` (verify >80% coverage)
6. START Docker compose (verify all services running)
7. Test end-to-end user flow

**Verification Requirements:** MUST provide actual command output, not summaries

### Agent 3: Deployment Readiness Engineer
**Agent ID:** `execution-deploy-ready`
**Memory Keys:** `austa/execute/deployment/*`
**Dependencies:** Agent 1, Agent 2 (needs working system)
**Priority:** 🟡 MEDIUM

**Tasks:**
1. Test Docker build for backend (verify image builds)
2. Test Docker build for frontend (verify image builds)
3. Run security scan (Trivy)
4. Test K8s manifests (dry-run)
5. Verify CI/CD pipeline runs end-to-end
6. Create ACTUAL deployment checklist (not theoretical)
7. Test complete deployment flow

**Verification Requirements:** Screenshots/outputs of successful builds and deployments

---

## 📊 DEPENDENCY GRAPH - EXECUTION FOCUS

```mermaid
graph TD
    COORD[Coordinator: Verify EVERYTHING] --> E1[Agent 1: Execution]
    E1 --> E2[Agent 2: Testing]
    E1 --> E3[Agent 3: Deployment]
    E2 --> COORD
    E3 --> COORD

    E1_TASKS[Create .env files<br/>npm install x2<br/>Prisma generate<br/>Migrations<br/>Seed data]
    E2_TASKS[Start servers<br/>Run tests<br/>Build frontend<br/>Docker compose<br/>E2E tests]
    E3_TASKS[Docker builds<br/>Security scan<br/>K8s validation<br/>CI/CD test<br/>Deploy flow]

    E1 --> E1_TASKS
    E2 --> E2_TASKS
    E3 --> E3_TASKS

    style COORD fill:#ff6b6b
    style E1 fill:#4ecdc4
    style E2 fill:#ffe66d
    style E3 fill:#95e1d3
```

**Execution Waves:**
- **Wave 1:** Agent 1 (environment + dependencies) - MUST complete before Wave 2
- **Wave 2:** Agent 2 (testing + builds) - Runs after Agent 1, parallel with Agent 3
- **Wave 3:** Agent 3 (deployment) - Runs after Agent 1, parallel with Agent 2

---

## 🔥 SWARM INITIALIZATION (EXECUTION-FOCUSED)

```javascript
// ✅ CORRECT PATTERN: Initialize for EXECUTION not documentation

[Message 1 - MCP + TodoWrite]:

// 1. MCP: Initialize execution-focused swarm
mcp__claude-flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 4,  // 3 workers + 1 verification coordinator
  strategy: "execution-verify",  // NEW: Verify EVERY claim
  persistMemory: true,
  sessionId: "austa-corrective-60to100-" + Date.now(),
  verificationMode: "strict"  // Coordinator rejects claims without proof
})

// 2. MCP: Spawn verification coordinator
mcp__claude-flow__agent_spawn({
  type: "coordinator",
  name: "Execution Verification Coordinator",
  role: "strict_verifier",
  memoryPattern: "austa/verify/*",
  verificationRules: [
    "reject_claims_without_file_proof",
    "reject_claims_without_command_output",
    "require_ls_output_for_created_files",
    "require_curl_output_for_running_servers",
    "require_actual_test_results_not_summaries"
  ]
})

// 3. MCP: Spawn execution agents
mcp__claude-flow__agent_spawn({ type: "executor", name: "Env+Deps Engineer", priority: "blocker" })
mcp__claude-flow__agent_spawn({ type: "executor", name: "Test+Verify Engineer", priority: "high" })
mcp__claude-flow__agent_spawn({ type: "executor", name: "Deploy Ready Engineer", priority: "medium" })

// 4. TodoWrite: EXECUTION-FOCUSED todos (NOT documentation todos)
TodoWrite({
  todos: [
    // Wave 1: EXECUTION (Agent 1) - NO dependencies, START NOW
    {id: "exec-env-dev", content: "CREATE (not document) .env.development file", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "cat .env.development | wc -l > 50", wave: "1"},
    {id: "exec-env-stg", content: "CREATE .env.staging file", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "cat .env.staging | wc -l > 50", wave: "1"},
    {id: "exec-env-prod", content: "CREATE .env.production file", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "cat .env.production | wc -l > 50", wave: "1"},
    {id: "exec-npm-backend", content: "RUN npm install in backend", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "ls backend/node_modules | wc -l > 100", wave: "1"},
    {id: "exec-npm-frontend", content: "RUN npm install in frontend", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "ls frontend/node_modules | wc -l > 100", wave: "1"},
    {id: "exec-prisma-gen", content: "RUN npx prisma generate", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "ls backend/node_modules/.prisma/client", wave: "1"},
    {id: "exec-migrate", content: "RUN npx prisma migrate deploy", status: "pending", priority: "blocker", agent: "execution-env-deps", verify: "psql -c 'SELECT * FROM _prisma_migrations'", wave: "1"},
    {id: "exec-seed", content: "RUN database seed script", status: "pending", priority: "high", agent: "execution-env-deps", verify: "psql -c 'SELECT COUNT(*) FROM users'", wave: "1"},

    // Wave 2: TESTING (Agent 2) - Depends on Wave 1
    {id: "exec-backend-start", content: "RUN npm run dev - verify server starts", status: "pending", priority: "high", agent: "execution-test-verify", verify: "curl http://localhost:3000/health returns 200", wave: "2", dependsOn: ["exec-env-dev", "exec-npm-backend"]},
    {id: "exec-frontend-build", content: "RUN npm run build in frontend", status: "pending", priority: "high", agent: "execution-test-verify", verify: "ls frontend/dist | wc -l > 5", wave: "2", dependsOn: ["exec-npm-frontend"]},
    {id: "exec-tests-run", content: "RUN npm test - verify tests pass", status: "pending", priority: "high", agent: "execution-test-verify", verify: "npm test returns exit code 0", wave: "2", dependsOn: ["exec-env-dev", "exec-npm-backend"]},
    {id: "exec-coverage", content: "RUN npm run test:coverage - verify >80%", status: "pending", priority: "high", agent: "execution-test-verify", verify: "coverage report shows >80%", wave: "2", dependsOn: ["exec-tests-run"]},
    {id: "exec-docker-compose", content: "RUN docker-compose up - verify all services", status: "pending", priority: "medium", agent: "execution-test-verify", verify: "docker-compose ps shows all UP", wave: "2", dependsOn: ["exec-env-dev"]},

    // Wave 3: DEPLOYMENT (Agent 3) - Depends on Wave 1, parallel with Wave 2
    {id: "exec-docker-backend", content: "RUN docker build for backend", status: "pending", priority: "medium", agent: "execution-deploy-ready", verify: "docker images shows backend image", wave: "3", dependsOn: ["exec-npm-backend"]},
    {id: "exec-docker-frontend", content: "RUN docker build for frontend", status: "pending", priority: "medium", agent: "execution-deploy-ready", verify: "docker images shows frontend image", wave: "3", dependsOn: ["exec-npm-frontend"]},
    {id: "exec-security-scan", content: "RUN trivy scan on built images", status: "pending", priority: "medium", agent: "execution-deploy-ready", verify: "trivy output with vulnerability count", wave: "3", dependsOn: ["exec-docker-backend"]},
    {id: "exec-k8s-validate", content: "RUN kubectl apply --dry-run on manifests", status: "pending", priority: "medium", agent: "execution-deploy-ready", verify: "kubectl dry-run succeeds", wave: "3", dependsOn: []},
    {id: "exec-cicd-test", content: "TRIGGER CI/CD pipeline test run", status: "pending", priority: "low", agent: "execution-deploy-ready", verify: "GitHub Actions shows green check", wave: "3", dependsOn: ["exec-tests-run"]},
  ]
})

// 5. MCP: Store initial execution state
mcp__claude-flow__memory_usage({
  action: "store",
  key: "austa/verify/init",
  value: {
    timestamp: Date.now(),
    mode: "execution_not_documentation",
    previousCompletion: "60%",
    targetCompletion: "100%",
    remainingWork: "40% execution gap",
    verificationMode: "strict",
    previousSwarmIssue: "documented_but_didnt_execute",
    thisSwarmFocus: "execute_and_prove"
  }
})
```

---

## 🔗 MANDATORY EXECUTION + VERIFICATION PROTOCOL

### BEFORE Starting ANY Task

```bash
# 1. Load context
npx claude-flow@alpha hooks pre-task \
  --description "[Your EXECUTION task - not documentation]" \
  --session-id "austa-corrective-60to100" \
  --auto-spawn-agents false

# 2. Check dependencies in memory
mcp__claude-flow__memory_usage({
  action: "retrieve",
  key: "austa/verify/tasks/[dependency-id]"
})

# 3. If dependencies NOT verified: mark as "blocked" and STOP
```

### DURING Task Execution (THE CRITICAL PART)

```bash
# ❌ WRONG (Previous Swarm Pattern):
# Write documentation about creating .env file
# Store in memory that .env was "created"
# Move to next task

# ✅ CORRECT (This Swarm Pattern):

# Step 1: Actually CREATE the file
cat > .env.development << 'EOF'
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
[50+ more variables]
EOF

# Step 2: VERIFY it exists
ls -la .env.development
# Output: -rw-r--r-- 1 user user 5234 Nov 16 .env.development

# Step 3: VERIFY content
wc -l .env.development
# Output: 85 .env.development

# Step 4: Store PROOF in memory (not just claim)
mcp__claude-flow__memory_usage({
  action: "store",
  key: "austa/verify/tasks/exec-env-dev",
  value: {
    taskId: "exec-env-dev",
    status: "completed",
    timestamp: Date.now(),
    proof: {
      commandRun: "cat > .env.development << EOF...",
      verificationCommand: "ls -la .env.development",
      verificationOutput: "-rw-r--r-- 1 user user 5234 Nov 16 .env.development",
      lineCount: 85,
      fileSize: 5234,
      contentSample: "NODE_ENV=development\nPORT=3000\nDATABASE_URL=..."
    }
  }
})

# Step 5: Post-edit hook with file path
npx claude-flow@alpha hooks post-edit \
  --file ".env.development" \
  --memory-key "austa/verify/exec-env-dev/complete"
```

### AFTER Completing Task (PROOF REQUIRED)

```bash
# ❌ WRONG:
# "Task complete, .env file created with 85 variables"
# ↑ This is what previous swarm did (claim without proof)

# ✅ CORRECT:
# 1. Provide actual command output
echo "=== TASK COMPLETION PROOF ==="
echo "Command executed: cat > .env.development << EOF"
echo "Verification: ls -la .env.development"
ls -la .env.development
echo "File size: $(wc -c < .env.development) bytes"
echo "Line count: $(wc -l < .env.development) lines"
echo "Sample (first 10 lines):"
head -10 .env.development

# 2. Store complete proof in memory
mcp__claude-flow__memory_usage({
  action: "store",
  key: "austa/verify/tasks/exec-env-dev",
  value: {
    status: "verified_complete",
    proof: {
      lsOutput: "...",
      fileSize: 5234,
      lineCount: 85,
      firstTenLines: "...",
      checksumMD5: "...",
      verifiedBy: "coordinator-execution-verify",
      verifiedAt: Date.now()
    }
  }
})

# 3. Post-task hook
npx claude-flow@alpha hooks post-task \
  --task-id "exec-env-dev" \
  --analyze-performance true \
  --verification-proof "ls output + file size + line count"
```

---

## 🎯 COORDINATOR VERIFICATION INTELLIGENCE

**You are the EXECUTION VERIFIER, not a documentation reviewer.**

### 1. Verify EVERY Claim (Hourly Checks)

```javascript
// Agent claims: "Created .env.development with 85 variables"
// Coordinator MUST verify:

const claim = {
  agentId: "execution-env-deps",
  taskId: "exec-env-dev",
  claim: "Created .env.development with 85 variables"
}

// Step 1: Demand proof
const proof = mcp__claude-flow__memory_usage({
  action: "retrieve",
  key: "austa/verify/tasks/exec-env-dev"
})

// Step 2: Validate proof
if (!proof.proof.lsOutput) {
  // REJECT: No file listing provided
  return {
    status: "REJECTED",
    reason: "No ls output provided - cannot verify file exists",
    requiredAction: "Run 'ls -la .env.development' and provide output"
  }
}

if (!proof.proof.lineCount || proof.proof.lineCount < 50) {
  // REJECT: Insufficient variables
  return {
    status: "REJECTED",
    reason: `Only ${proof.proof.lineCount} lines, need 85+`,
    requiredAction: "Complete the .env file with all required variables"
  }
}

if (!proof.proof.contentSample) {
  // REJECT: No content verification
  return {
    status: "REJECTED",
    reason: "No file content sample provided",
    requiredAction: "Run 'head -20 .env.development' and provide output"
  }
}

// Step 3: If all checks pass
return {
  status: "VERIFIED",
  confidence: "high",
  evidence: proof.proof
}
```

### 2. Real vs Fake Completion Detection

```javascript
// Patterns of FAKE completion (reject these):
const fakePatterns = [
  "Successfully created .env file" // ← Just words, no proof
  "Environment configured with 85+ variables" // ← Just claim
  "npm install completed" // ← No verification
  "Tests passing" // ← No test output shown
  "Server is running" // ← No curl output
]

// Patterns of REAL completion (accept these):
const realPatterns = [
  "$ ls -la .env.development\n-rw-r--r-- 5234 bytes" // ← Actual command output
  "$ cat .env.development | wc -l\n85" // ← Actual verification
  "$ npm install\n[npm install output]\nadded 1234 packages" // ← Actual execution
  "$ npm test\n[test output]\nTests: 288 passed" // ← Actual test results
  "$ curl localhost:3000/health\n{\"status\":\"healthy\"}" // ← Actual response
]

// Verification rule:
if (claim.includes('$') && claim.includes('output')) {
  // Looks like actual command execution
  return "ACCEPT"
} else {
  // Looks like just documentation
  return "REJECT - Provide actual command output"
}
```

### 3. Force Re-Execution When Needed

```javascript
// If agent provides weak evidence:
const agentClaim = memory.retrieve("austa/verify/tasks/exec-npm-backend")

if (agentClaim.status === "completed" && !agentClaim.proof.lsOutput) {
  // Force re-execution with proper verification
  TodoWrite({
    todos: [{
      id: "exec-npm-backend",
      status: "pending", // ← Reset to pending
      notes: "COORDINATOR: Previous completion lacked verification. Re-execute with 'ls backend/node_modules | wc -l' proof required"
    }]
  })

  // Notify agent
  npx claude-flow@alpha hooks notification \
    --message "Task exec-npm-backend REJECTED - no node_modules verification. Re-execute and provide 'ls' output." \
    --telemetry true
}
```

---

## 🔥 AGENT TASK EXECUTION PATTERNS

### Agent 1: Environment + Dependencies (CRITICAL)

```javascript
// ✅ CORRECT EXECUTION PATTERN

[Message 1 - Create ALL .env files]:

// 1. Create .env.development
Write(".env.development", `
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/austa_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
[... 75+ more variables following DEVOPS_DATABASE_SETUP_COMPLETE.md specs]
`)

// 2. Create .env.staging (88+ variables)
Write(".env.staging", `
NODE_ENV=staging
PORT=3000
[... 88+ variables]
`)

// 3. Create .env.production (105+ variables)
Write(".env.production", `
NODE_ENV=production
PORT=3000
[... 105+ variables]
`)

// 4. VERIFY all files created
Bash("ls -la .env.development .env.staging .env.production")
Bash("wc -l .env.development .env.staging .env.production")
Bash("head -20 .env.development") // Show sample content

// 5. Store verification in memory
mcp__claude-flow__memory_usage({
  action: "store",
  key: "austa/verify/tasks/exec-env-all",
  value: {
    filesCreated: [".env.development", ".env.staging", ".env.production"],
    verification: {
      devLines: 85,
      stagingLines: 88,
      productionLines: 105,
      lsOutput: "...",
      sampleContent: "..."
    }
  }
})

[Message 2 - Install dependencies]:

// 6. Install backend dependencies
Bash("cd backend && npm install")

// 7. VERIFY node_modules exists
Bash("ls -la backend/node_modules | head -20")
Bash("ls backend/node_modules | wc -l") // Count packages

// 8. Install frontend dependencies
Bash("cd frontend && npm install")

// 9. VERIFY frontend node_modules
Bash("ls frontend/node_modules | wc -l")

// 10. Store verification
mcp__claude-flow__memory_usage({
  action: "store",
  key: "austa/verify/tasks/exec-npm-all",
  value: {
    backendPackages: 1234,
    frontendPackages: 567,
    proof: "ls output showing node_modules directories"
  }
})

[Message 3 - Database setup]:

// 11. Generate Prisma client
Bash("cd backend && npx prisma generate")

// 12. VERIFY client generated
Bash("ls backend/node_modules/.prisma/client")

// 13. Run migrations
Bash("cd backend && npx prisma migrate deploy")

// 14. VERIFY migrations ran
Bash("psql $DATABASE_URL -c 'SELECT * FROM _prisma_migrations'")

// 15. Run seed
Bash("cd backend && npm run db:seed")

// 16. VERIFY data seeded
Bash("psql $DATABASE_URL -c 'SELECT COUNT(*) FROM users'")
```

### Agent 2: Testing + Verification

```javascript
// Wait for Agent 1 completion
const envReady = mcp__claude-flow__memory_usage({
  action: "retrieve",
  key: "austa/verify/tasks/exec-env-all"
})

if (!envReady || !envReady.verification) {
  TodoWrite({ todos: [{ id: "exec-backend-start", status: "blocked" }] })
  return "BLOCKED - waiting for .env files"
}

// ✅ CORRECT: Actually start and test

[Message 1 - Start backend]:

// 1. Start backend (background)
Bash("cd backend && npm run dev", { run_in_background: true })

// 2. Wait for startup
Bash("sleep 5")

// 3. VERIFY server is running
Bash("curl http://localhost:3000/health")

// 4. VERIFY health check returns 200
// Expected output: {"status":"healthy","timestamp":...}

[Message 2 - Build frontend]:

// 5. Build frontend
Bash("cd frontend && npm run build")

// 6. VERIFY dist folder created
Bash("ls -la frontend/dist")
Bash("du -sh frontend/dist") // Check size

[Message 3 - Run tests]:

// 7. Run tests
Bash("cd backend && npm test")

// 8. Run coverage
Bash("cd backend && npm run test:coverage")

// 9. VERIFY >80% coverage
// Parse coverage output and verify threshold met
```

---

## ✅ COMPLETION CRITERIA (STRICT VERIFICATION)

### Wave 1: Execution Agent ✅

**All tasks MUST have proof:**
- [ ] .env.development exists: `cat .env.development | wc -l` shows 85+
- [ ] .env.staging exists: `cat .env.staging | wc -l` shows 88+
- [ ] .env.production exists: `cat .env.production | wc -l` shows 105+
- [ ] Backend deps installed: `ls backend/node_modules | wc -l` shows 100+
- [ ] Frontend deps installed: `ls frontend/node_modules | wc -l` shows 100+
- [ ] Prisma client generated: `ls backend/node_modules/.prisma/client` shows files
- [ ] Migrations ran: `psql -c 'SELECT * FROM _prisma_migrations'` shows migration
- [ ] Seed data loaded: `psql -c 'SELECT COUNT(*) FROM users'` shows > 0

### Wave 2: Testing Agent ✅

**All tasks MUST have proof:**
- [ ] Backend starts: `curl localhost:3000/health` returns `{"status":"healthy"}`
- [ ] Frontend builds: `ls frontend/dist` shows files, `du -sh` shows size
- [ ] Tests run: `npm test` exit code 0
- [ ] Coverage met: `npm run test:coverage` shows >80%
- [ ] Docker compose: `docker-compose ps` shows all containers UP

### Wave 3: Deployment Agent ✅

**All tasks MUST have proof:**
- [ ] Backend image: `docker images` shows backend image
- [ ] Frontend image: `docker images` shows frontend image
- [ ] Security scan: `trivy` output with vulnerability report
- [ ] K8s valid: `kubectl apply --dry-run` succeeds

---

## 🎯 FINAL DELIVERABLE

**NOT A DOCUMENT** - An ACTUALLY WORKING system:

1. ✅ User runs: `docker-compose up -d`
2. ✅ System starts (all services UP)
3. ✅ User visits: `http://localhost:80`
4. ✅ Frontend loads successfully
5. ✅ User can login and use the system
6. ✅ Backend responds to API calls
7. ✅ Database has data
8. ✅ Tests pass
9. ✅ Health checks return green

**If ANY of the above fails, the swarm has FAILED.**

---

## 🚨 CRITICAL REMINDERS

1. **EXECUTE, DON'T DOCUMENT** - If it doesn't have `$` command output, it's not done
2. **VERIFY EVERYTHING** - `ls`, `cat`, `curl`, `wc`, `du` are your friends
3. **STORE PROOF** - Every completion claim needs command output proof
4. **COORDINATOR REJECTS WEAK CLAIMS** - No proof = not done
5. **BATCH TOOL OPERATIONS** - Multiple related commands in ONE message
6. **MCP MEMORY PERSISTENCE** - Store verification proof, not just claims

---

**EXECUTION START COMMAND:**

```bash
cd /home/user/Coordenacao-Cuidado-Enterprise

# Option 1: Automated
npx claude-flow@alpha execute \
  --prompt ./docs/CORRECTIVE_SWARM_EXECUTION_PROMPT.md \
  --parallel true \
  --verify-mode strict \
  --agents 4

# Option 2: Manual
# Send this prompt to Claude Code with instruction:
# "Execute the corrective swarm with strict verification mode"
```

---

**STATUS:** Ready for corrective execution (60% → 100%)
**MODE:** Execution + Verification (NOT documentation)
**VERIFICATION:** Strict (proof required for every claim)
**PHILOSOPHY:** If you can't `ls` it, it doesn't exist ✅
