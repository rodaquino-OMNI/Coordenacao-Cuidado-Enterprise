# Forensic Cleanup Plan — AUSTA Care Platform

> **Date:** 2026-06-26
> **Scope:** 526 files analyzed, 400+ orphan/legacy files identified

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| 🟢 Not harmful, delete safely | ~140 files | Wave 0 |
| 🔴 Harmful, requires code changes first | ~15 files + dirs | Wave 1 |
| 🟡 Documentation orphans | ~15 files | Wave 2 |
| Total cleanup potential | ~170 files | |

---

## 🔴 Category H: HARMFUL (contain errors/bugs)

| # | Path | Why Harmful | Required Before Deletion |
|---|------|-------------|--------------------------|
| H1 | `src/infrastructure/mongodb/mongodb.client.ts` | Imported in server.ts line 36; initialized at startup line 174. CRASHES if MongoDB not running. MongoDB is NOT in the stack (PostgreSQL-only). | Remove imports in server.ts, config files |
| H2 | `src/infrastructure/kafka/` (5 files) | Imported in server.ts line 34; connected at startup. CRASHES if Kafka unavailable. Kafka is aspirational, not active. | Remove imports in server.ts, config files |
| H3 | `src/infrastructure/ml/` (7 files) | Imported in server.ts line 38; initialized at startup. May crash if ML not configured. | Check active usage; remove if dead |
| H4 | `backend/prisma/schema.prisma` (644 lines) | DIFFERENT from root schema (uses UUID vs CUID, different field types). STALE — team may accidentally use it. | Ensure root schema is canonical, then delete |
| H5 | `docs/_analysis/section-05-architecture.md` | 12+ architectural contradictions. Describes Python/Java that don't exist. Misleads developers. | Safe to delete (analysis artifact) |

## 🟢 Category S: SAFE TO DELETE (no compilation impact)

| # | Path | Count | Reason |
|---|------|-------|--------|
| S1 | `tests/setup.js`, `tests/setup.d.ts`, `tests/setup.js.map` | 3 | Compiled artifacts, not needed by Jest |
| S2 | `tests/utils/test-helpers.d.ts`, `tests/utils/test-helpers.js.map` | 2 | Compiled artifacts, not needed |
| S3 | `src/tests/services/advanced-risk-assessment.test.ts` | 1 | STALE copy — `tests/unit/services/` has the active version |
| S4 | `src/tests/utils/webhook.test.ts` | 1 | STALE copy — `tests/unit/webhook.test.ts` has the active version |
| S5 | `austa-care-platform/hive/` | 19 files | Historical fix-swarm reports, not needed for runtime |
| S6 | `.claude/` | 260 files | Claude Code agent definitions, unrelated to platform |
| S7 | `.claude-flow/` | 120 files | Claude Flow logs and configuration |
| S8 | `docs/_analysis/` | 10 files | Analysis artifacts, already served purpose |
| S9 | `backend/coverage/` | ~100 files (20MB) | Code coverage reports, regeneratable |
| S10 | `agentdb.rvf.lock` | 1 | Lock file, already gitignored |

## 🟡 Category D: DOCUMENTATION ORPHANS

| # | Path | Reason |
|---|------|--------|
| D1 | `docs/architecture_diagrams.md` | Describes Python/Java stack that doesn't exist |
| D2 | `monitoring/grafana/dashboards/` | SECOND set of dashboards (different from `infrastructure/monitoring/grafana/dashboards/`) |

---

## Execution Plan

### Wave 0: Safe Deletions (S1–S10)
All files have zero compilation dependencies — can be deleted in parallel.

### Wave 1: Code Changes + Hazardous Removals (H1–H4)
Must modify server.ts before deleting infrastructure:

1. Remove `kafkaClient`, `mongoDBClient`, `mlPipeline` imports from server.ts
2. Remove initialization calls (`connectProducer`, `connect`, `initialize`)
3. Remove shutdown calls (`disconnect`, `shutdown`)
4. Remove configuration references in config files
5. DELETE: `mongodb.client.ts`, `kafka/` directory, backend prisma schema
6. Keep `ml/` if actively used by clinical services

### Wave 2: Documentation Cleanup (D1–D2)
Safe documentation changes.
