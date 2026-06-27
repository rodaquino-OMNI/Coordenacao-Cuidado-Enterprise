# docs/review-queue.md — Fila de Revisão Regulatória/Clínica
# Coordenação-Cuidado Enterprise / AUSTA Care Platform
# Última revisão: 2026-06-27 (Wave 4 — final compliance audit)

| # | Artifact | Status | Reviewer | Date | Notes |
|---|----------|--------|----------|------|-------|
| 1 | ANVISA SaMD Classification (RDC 657/2022) | ⬜ DRAFT | Especialista regulatório | — | Classificar como Classe II ou III. Definir "intended use statement". Especialista ainda não engajado. Arquitetura técnica completa (4 waves). |
| 2 | LGPD RIPD (Relatório de Impacto) | ⬜ DRAFT | DPO/Encarregado | — | Obrigatório Art. 38 LGPD para dados sensíveis de saúde em larga escala. Infraestrutura técnica pronta (pgcrypto, audit trail, consent). Aguardando DPO. |
| 3 | Validação clínica — Algoritmo de Risk Scoring | ⬜ DRAFT | Diretor Médico | — | 1564 linhas de lógica clínica; validar thresholds, sensibilidade, especificidade. Código versionado via algorithm-registry.ts. |
| 4 | Validação clínica — Emergency Detection | ⬜ DRAFT | Diretor Médico | — | Protocolos de ACS, CAD, crise hipertensiva, risco de suicídio, etc. Código versionado. |
| 5 | Validação clínica — Questionário de Onboarding | ⬜ DRAFT | Diretor Médico | — | 958 linhas de roteiro conversacional; validar perguntas indiretas para CPT. |
| 6 | Revisão jurídica — Adoção do framework LGPD/ANS/ANVISA | ✅ APPROVED | parreira (Wave 0 + Wave 3 + Wave 4 final) | 2026-06-27 | **FINAL AUDIT: 0 HIPAA references outside _analysis.** 205 LGPD references. 21 arquivos modificados, migration 002 executada. pgcrypto, audit trail, algorithm versioning, idempotência e secrets verificados. |
| 7 | SBIS Certification path | ⬜ DRAFT | CTO | — | Certificação SBIS é mandatória na prática para software hospitalar brasileiro |
| 8 | ISO 27001 gap analysis | ⬜ DRAFT | CISO | — | Documentação menciona ISO 27001 mas não há evidência de certificação |
| 9 | Pentest externo (annual requirement) | ⬜ DRAFT | CISO | — | Não foram encontrados relatórios de pentest no repositório |
| 10 | Consent Management LGPD — Revisão jurídica | ✅ APPROVED | parreira (Wave 4 final) | 2026-06-27 | Fluxo de consentimento gamificado implementado em Questionary_Sugested.md com opt-out explícito e incentivo HealthPoints. Base legal Art. 7 (consent) com fallback Art. 11 (proteção à vida). |

**Status Legend:** ⬜ DRAFT → ⏳ PENDING_REVIEW → ✅ APPROVED → ❌ REJECTED
