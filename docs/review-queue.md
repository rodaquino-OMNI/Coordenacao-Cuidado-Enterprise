# docs/review-queue.md — Fila de Revisão Regulatória/Clínica
# Coordenação-Cuidado Enterprise / AUSTA Care Platform
# Última revisão: 2026-06-26 (Wave 3 — compliance final)

| # | Artifact | Status | Reviewer | Date | Notes |
|---|----------|--------|----------|------|-------|
| 1 | ANVISA SaMD Classification (RDC 657/2022) | ⬜ DRAFT | Especialista regulatório | — | Classificar como Classe II ou III. Definir "intended use statement". |
| 2 | LGPD RIPD (Relatório de Impacto) | ⬜ DRAFT | DPO/Encarregado | — | Obrigatório Art. 38 LGPD para dados sensíveis de saúde em larga escala |
| 3 | Validação clínica — Algoritmo de Risk Scoring | ⬜ DRAFT | Diretor Médico | — | 1564 linhas de lógica clínica; validar thresholds, sensibilidade, especificidade |
| 4 | Validação clínica — Emergency Detection | ⬜ DRAFT | Diretor Médico | — | Protocolos de ACS, CAD, crise hipertensiva, risco de suicídio, etc. |
| 5 | Validação clínica — Questionário de Onboarding | ⬜ DRAFT | Diretor Médico | — | 958 linhas de roteiro conversacional; validar perguntas indiretas para CPT |
| 6 | Revisão jurídica — Adoção do framework LGPD/ANS/ANVISA | ✅ APPROVED | parreira (Wave 0 + verificação Wave 3) | 2026-06-26 | 0 referências a frameworks estrangeiros. 21 arquivos modificados, migration 002 executada. pgcrypto, audit trail, algorithm versioning, idempotência e secrets verificados. |
| 7 | SBIS Certification path | ⬜ DRAFT | CTO | — | Certificação SBIS é mandatória na prática para software hospitalar brasileiro |
| 8 | ISO 27001 gap analysis | ⬜ DRAFT | CISO | — | Documentação menciona ISO 27001 mas não há evidência de certificação |
| 9 | Pentest externo (annual requirement) | ⬜ DRAFT | CISO | — | Não foram encontrados relatórios de pentest no repositório |
| 10 | Consent Management LGPD — Revisão jurídica | ⬜ DRAFT | Jurídico | — | Fluxo de consentimento gamificado em Questionary_Sugested.md; validar bases legais (Art. 11) |

**Status Legend:** ⬜ DRAFT → ⏳ PENDING_REVIEW → ✅ APPROVED → ❌ REJECTED
