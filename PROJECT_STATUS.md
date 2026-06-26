# PROJECT_STATUS.md — AUSTA Care Platform

**Status Global:** ⚠️ ALPHA / PRE-PRODUCTION — *não pronto para dados reais de pacientes*
**Data:** 2026-06-26
**Autor:** parreira (compliance review — Wave 3 final)
**Plataforma:** Coordenação-Cuidado Enterprise / AUSTA Care Platform
**Mercado:** Saúde suplementar brasileira (planos de saúde)

---

## 🎯 Objetivo do Documento

Este documento é o **ponto de entrada para stakeholders** (CTO, Diretor Médico, DPO, CISO, investidores) entenderem o estado real do projeto. Ele é **honesto por princípio** — não tenta esconder bloqueios ou riscos.

**Link para análise técnica completa:** [PLATFORM-REVIEW.md](docs/_analysis/PLATFORM-REVIEW.md)

---

## ✅ O Que Funciona

| Área | Status | Detalhes |
|------|--------|----------|
| **TypeScript** | ✅ Compila | Backend com 140+ arquivos TypeScript, Prisma ORM, Express. `tsc --noEmit` = exit code 0 (sem erros no src/) |
| **Serviços clínicos** | ✅ Implementados | Risk assessment (1564 linhas), emergency detection (579 linhas), onboarding (958 linhas) |
| **Audit trail** | ✅ Persistente | `prisma.auditLog.create()` em `auditService.ts`. LGPD + ANS compliance. |
| **Criptografia em repouso** | ✅ Implementada | pgcrypto (`pgp_sym_encrypt`/`decrypt`) via `lib/crypto.ts`. Envelope encryption por tenant. |
| **CI/CD** | ✅ Corrigido | GitHub Actions pipelines corrigidos para `sa-east-1` |
| **Kubernetes** | ✅ Manifests completos | Namespace, deployments (2), services (2), ingress, HPA, network policy, configmaps |
| **Terraform** | ✅ 6 módulos | VPC, RDS, ElastiCache, EKS, S3, IAM — todos em `sa-east-1` |
| **Healthcare invariants** | ✅ 6/6 verificados | Audit trail, idempotência, versionamento, criptografia, health check, retry |
| **HIPAA → LGPD** | ✅ Substituído | 0 referências HIPAA. 21 arquivos modificados, migration 002 executada |
| **Health check** | ✅ 5 endpoints | `/health`, `/health/detailed`, `/health/ready`, `/health/live`, `/health/dead-mans-switch` |

---

## ⚠️ O Que Requer Atenção (Antes de Go-Live)

| Área | Severity | Detalhes | Bloqueador de produção? |
|------|----------|----------|--------------------------|
| **Classificação ANVISA SaMD** | 🔴 CRITICAL | Plataforma realiza scoring clínico + detecção de emergências. RDC 657/2022 exige classificação Classe II ou III antes de processar dados reais. | **SIM** |
| **Validação clínica dos algoritmos** | 🔴 CRITICAL | Risk assessment, emergency detection, e questionário de onboarding implementam lógica clínica sem validação por equipe médica. Thresholds, sensibilidade e especificidade não calibrados. | **SIM** |
| **RIPD LGPD** | 🟠 HIGH | Relatório de Impacto à Proteção de Dados (Art. 38 LGPD) não iniciado. Obrigatório para tratamento de dados sensíveis de saúde em larga escala. | **SIM** |
| **Pentest externo** | 🟠 HIGH | Nenhum relatório de penetration test encontrado. Exigido pela ANS e ISO 27001. | **SIM** |
| **Certificação SBIS** | 🟡 MEDIUM | SBIS é mandatória na prática para software hospitalar brasileiro. Caminho de certificação não iniciado. | NÃO (pós-go-live) |
| **ISO 27001 gap analysis** | 🟡 MEDIUM | Documentação menciona ISO 27001 mas sem evidência de certificação. | NÃO (pós-go-live) |
| **Consent Management LGPD** | 🟡 MEDIUM | Fluxo de consentimento gamificado desenhado mas não validado juridicamente (Art. 11 LGPD). | SIM |

---

## 🔴 O Que Está Bloqueado

| Bloqueio | Bloqueador | Efeito |
|----------|------------|--------|
| **Processamento de dados reais de pacientes** | ANVISA + RIPD | Impossível processar dados de pacientes reais sem classificação SaMD e RIPD aprovado |
| **Deploy em produção** | ANVISA + RIPD + Pentest | K8s e Terraform prontos, mas sem aprovação regulatória não há go-live |
| **Uso clínico dos algoritmos** | Validação médica | Algoritmos implementados mas não validados — risco de falso-positivo/negativo em contexto clínico |

---

## 📊 Linha do Tempo Estimada para Go-Live

| Marco | Dependência | Estimativa |
|-------|-------------|------------|
| Classificação ANVISA SaMD | Especialista regulatório | 2-4 meses |
| RIPD LGPD | DPO/Encarregado | 1-2 meses |
| Validação clínica | Diretor Médico | 2-3 meses |
| Pentest externo | CISO + fornecedor externo | 1-2 meses |
| **Go-Live com dados reais** | Todos acima | **6-12 meses (estimado)** |

---

## 🔗 Artefatos de Governança

| Artefato | Status | Link |
|----------|--------|------|
| PLATFORM-REVIEW.md (análise técnica) | ✅ Complete | [docs/_analysis/PLATFORM-REVIEW.md](docs/_analysis/PLATFORM-REVIEW.md) |
| HANDOFF.yaml (bloqueios críticos) | ✅ Atualizado | [HANDOFF.yaml](HANDOFF.yaml) |
| review-queue.md (fila regulatória) | ✅ Atualizado | [docs/review-queue.md](docs/review-queue.md) |
| HEALTHCARE-INVARIANTS.md | ✅ 6/6 verificados | [docs/HEALTHCARE-INVARIANTS.md](docs/HEALTHCARE-INVARIANTS.md) |
| Requisitos.md | ✅ v3.0 | [docs/Requisitos.md](docs/Requisitos.md) |
| Architecture diagrams | ✅ 8 diagramas Mermaid | [docs/architecture_diagrams.md](docs/architecture_diagrams.md) |

---

## 🏗️ Build Status (verificado 2026-06-26)

| Pipeline | Status |
|----------|--------|
| Backend CI | ⚠️ Pending (GitHub Actions em sa-east-1) |
| TypeScript (`tsc --noEmit`) | ✅ **PASS** — 0 erros no código-fonte (src/) |
| Tests (`npm test`) | ⚠️ **107/120 pass** — 13 falhas são type errors em arquivos de teste, não código de produção |
| CodeQL Security | ⚠️ Pending |

---

## 📝 Compliance Verification (2026-06-26)

| Check | Status |
|-------|--------|
| HIPAA references in code | ✅ 0 found |
| pgcrypto functional | ✅ Extension loaded + encryptPHI/decryptPHI |
| AuditLog persistent | ✅ `prisma.auditLog.create()` |
| Algorithm versioning | ✅ `algorithm-registry.ts` (4 algorithms) |
| WhatsApp idempotency | ✅ `whatsappMessageId @unique` |
| Secrets not hardcoded | ✅ `${VAR}` pattern in docker-compose |

---

## ⚡ Resumo para Stakeholders

**A plataforma está tecnicamente avançada mas regulatoriamente bloqueada.**

- **Código:** Backend + Frontend + Infra completos, com 6 invariantes de healthcare verificados
- **Regulatório:** Sem classificação ANVISA, sem RIPD LGPD — impossível processar dados reais
- **Clínico:** Algoritmos implementados mas sem validação médica — risco clínico inaceitável
- **Recomendação:** Priorizar contratação de especialista regulatório ANVISA + DPO antes de qualquer desenvolvimento adicional de features

**Próximo passo recomendado:** Iniciar processo de classificação ANVISA SaMD (RDC 657/2022) e elaboração do RIPD LGPD em paralelo.
