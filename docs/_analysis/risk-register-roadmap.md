# Risk Register & Forward Roadmap — AUSTA Care Platform

> **Status:** DRAFT — to be merged into PLATFORM-REVIEW.md Sections 8-9
> **Generated:** 2026-06-26 by Parreira

---

## 8. Gaps, Open Questions & Risks

### Risk Register (prioritized by Severity × Likelihood)

| ID | Risk | Severity | Likelihood | Impact | Resolution | Owner |
|----|------|----------|------------|--------|------------|-------|
| **RISK-001** | **Operação sem classificação ANVISA** — Processamento de dados clínicos (scoring, emergency detection) sem registro SaMD | 🔴 Critical | 🔴 Very High | Multa, interdição, responsabilidade criminal (RDC 657/2022) | Contratar especialista regulatório ANVISA; classificar antes de任何 paciente real | Diretor Médico + Regulatório |
| **RISK-002** | **HIPAA claim enganoso** — "HIPAA-compliant" em package.json e schema sem aplicabilidade ao Brasil | 🔴 Critical | 🔴 Very High | Dano reputacional, questionamento ANS/ANVISA, possível litígio | Substituir todas referências HIPAA por LGPD/ANS; auditar claims | DPO + Jurídico |
| **RISK-003** | **Vazamento de PHI por criptografia insuficiente** — pgcrypto carregado mas sem implementação visível de column-level encryption | 🔴 Critical | 🟠 Medium | Violação LGPD Art. 46, notificação ANPD em 48h, multa de até 2% faturamento | Implementar envelope encryption com KMS; verificar colunas sensíveis | Tech Lead + CISO |
| **RISK-004** | **Decisão clínica sem validação médica** — Algoritmos de risco e emergência sem revisão por especialistas | 🔴 Critical | 🟡 Medium | Risco ao paciente, responsabilidade civil/CFM, perda de licença médica | Validação por equipe médica multidisciplinar; documentar evidência | Diretor Médico |
| **RISK-005** | **Arquitetura over-engineered bloqueia MVP** — 10 containers documentados vs 1 implementado | 🟠 High | 🔴 Very High | Atraso de 6-12 meses no MVP se tentarem implementar arquitetura completa | ADR-003: adotar monolith-first; extrair microservices sob demanda | CTO + Tech Lead |
| **RISK-006** | **Falta de RIPD (LGPD)** — Relatório de Impacto à Proteção de Dados não iniciado | 🟠 High | 🔴 Very High | Violação LGPD Art. 38; impossibilidade legal de tratar dados sensíveis | Iniciar RIPD imediatamente com DPO | DPO |
| **RISK-007** | **Idempotência de mensagens WhatsApp não verificada** — Mensagens duplicadas podem gerar ações clínicas duplicadas | 🟠 High | 🟡 Medium | Risco ao paciente (alertas duplicados, agendamentos duplicados) | ADR-006: implementar INSERT ON CONFLICT DO NOTHING via whatsappMessageId | Tech Lead |
| **RISK-008** | **Dependência de serviços externos sem fallback** — Redis crash parava servidor (já corrigido); WhatsApp API, OpenAI, Tasy sem circuit breaker visível | 🟠 High | 🟡 Medium | Indisponibilidade da plataforma se API externa falhar | Implementar circuit breaker pattern; graceful degradation para todos os serviços externos | DevOps |
| **RISK-009** | **Ausência de CI/CD formal** — Sem GitHub Actions workflows visíveis; deploy manual | 🟡 Medium | 🟠 High | Erro humano em deploy; rollback lento; inconsistência entre ambientes | Criar pipelines CI/CD com testes, build, deploy automatizado | DevOps |
| **RISK-010** | **Terraform incompleto** — Apenas tfvars.example; sem main.tf, state management, modules | 🟡 Medium | 🟡 Medium | Infraestrutura como código incompleta; provisioning manual propenso a drift | Completar módulos Terraform para AWS; configurar remote state (S3+DynamoDB) | DevOps |
| **RISK-011** | **SBIS certification gap** — Certificação mandatória na prática para software hospitalar brasileiro | 🟡 Medium | 🟠 High | Barreira de entrada no mercado; hospitais exigem SBIS | Iniciar processo de certificação SBIS; gap analysis | CTO |
| **RISK-012** | **Algorithm versioning ausente** — Scores clínicos não registram versão do algoritmo | 🟡 Medium | 🟡 Medium | Impossibilidade de auditoria clínica; não-conformidade CFM | ADR-005: adicionar algorithm_version a todas entidades clínicas | Tech Lead |
| **RISK-013** | **MongoDB na stack desnecessariamente** — Adiciona complexidade operacional sem caso de uso claro (PostgreSQL JSONB cobre) | 🟢 Low | 🟡 Medium | Custo operacional, superfície de ataque, manutenção extra | Eliminar MongoDB da stack MVP; usar PostgreSQL JSONB para dados não-estruturados | Tech Lead |
| **RISK-014** | **Testes aspiracionais vs reais** — Documentação promete 80% coverage, 100% critical path; implementação real desconhecida | 🟡 Medium | 🟡 Medium | Falsa confiança na qualidade; bugs em produção | Executar cobertura real; definir metas alcançáveis | Tech Lead + QA |

### Open Questions

| # | Question | Priority |
|---|----------|----------|
| Q1 | Qual a base legal LGPD para processamento? Consentimento (Art. 7º, I) ou proteção da vida (Art. 11, II, g)? | 🔴 Critical |
| Q2 | A plataforma será comercializada como SaaS multi-tenant ou single-tenant por operadora? | 🟠 High |
| Q3 | Existe acordo BAA (Business Associate Agreement) com a Meta para WhatsApp? (mencionado em Requisitos.md §4.2) | 🟠 High |
| Q4 | Quais operadoras de saúde (ANS) são clientes-alvo iniciais? | 🟡 Medium |
| Q5 | Qual o orçamento de infraestrutura cloud mensal previsto? | 🟡 Medium |
| Q6 | Existe equipe de enfermagem/navegação contratada para responder aos alerts? | 🔴 Critical |
| Q7 | Os dados do ERP Tasy são acessíveis via API? Existe acordo de integração? | 🟠 High |
| Q8 | Qual o cronograma realista para o primeiro paciente? | 🔴 Critical |

---

## 9. Forward Roadmap — Points to Advance

### ⏱️ NOW (Semanas 1-4): Fundação Regulatória e Técnica

| ID | Item | Rationale | Effort | Serves |
|----|------|-----------|--------|--------|
| **NEXT-001** | **Contratar especialista ANVISA e classificar plataforma** | RISK-001: Operar sem classificação é ilegal | M (2-4 sem) | LGPD, ANVISA, CFM |
| **NEXT-002** | **Substituir HIPAA→LGPD em todo código/docs** | RISK-002: HIPAA claim é enganoso; ADR-001 | S (1-2 sem) | LGPD compliance |
| **NEXT-003** | **Implementar 6 invariantes healthcare** | RISK-003/007/012: Pré-requisitos para paciente real | L (3-4 sem) | LGPD Art. 46, CFM |
| **NEXT-004** | **Validar algoritmos clínicos com equipe médica** | RISK-004: Risco ao paciente | M (2-3 sem) | CFM, segurança paciente |
| **NEXT-005** | **Iniciar RIPD (Relatório de Impacto LGPD)** | RISK-006: Obrigatório Art. 38 | M (2-4 sem) | LGPD |
| **NEXT-006** | **Criar pipeline CI/CD básico (GitHub Actions)** | RISK-009: Deploy manual é risco | S (1 sem) | DevOps maturity |

### 🔜 NEXT (Meses 2-4): Consolidação da Plataforma

| ID | Item | Rationale | Effort | Serves |
|----|------|-----------|--------|--------|
| **NEXT-007** | **Simplificar arquitetura (ADR-003)** — remover MongoDB, adiar Kafka/Camunda/Spark | RISK-005: Over-engineering; reduzir superfície operacional | M (2-3 sem) | MVP velocity |
| **NEXT-008** | **Implementar column-level encryption (ADR-004)** | RISK-003: Proteção PHI; pgcrypto envelope encryption | L (3-4 sem) | LGPD Art. 46 |
| **NEXT-009** | **Implementar idempotência de mensagens (ADR-006)** | RISK-007: Segurança do paciente | S (1 sem) | Patient safety |
| **NEXT-010** | **Implementar versionamento de algoritmos (ADR-005)** | RISK-012: Auditoria clínica | S (1 sem) | CFM, audit readiness |
| **NEXT-011** | **Completar módulos Terraform AWS** | RISK-010: IaC incompleto; provisionar sa-east-1 | M (2-3 sem) | Infra reliability |
| **NEXT-012** | **Criar dashboards Grafana operacionais** | Observability gap; usar configs existentes em monitoring/ | S (1 sem) | DevOps, SRE |
| **NEXT-013** | **Integração real com ERP Tasy (OAuth2)** | RISK-008: Circuit breaker; mock atual não é suficiente | L (3-4 sem) | Business operations |

### 🔮 LATER (Meses 5-12): Escala e Diferenciação

| ID | Item | Rationale | Effort | Serves |
|----|------|-----------|--------|--------|
| **NEXT-014** | **Certificação SBIS** | RISK-011: Requisito de mercado para hospitais | L (3-6 mes) | Market access |
| **NEXT-015** | **ISO 27001 certification path** | Requisitos.md §4.2 menciona; iniciar gap analysis | XL (6-12 mes) | Enterprise sales |
| **NEXT-016** | **Pentest externo e remediação** | RISK-014: Segurança de dados de saúde | M (1-2 mes) | Security posture |
| **NEXT-017** | **FHIR R4 interoperability completa** | HAPI FHIR server já configurado; popular com dados reais | L (3-4 mes) | Interoperabilidade |
| **NEXT-018** | **Extrair microserviços sob demanda** — começar pelo Risk Engine | ADR-003: Scaling triggers; se latência >200ms P99 | L (2-3 mes) | Performance |
| **NEXT-019** | **Kafka event streaming (Phase 3)** | Requisitos.md Phase 3; necessário para real-time analytics | XL (4-6 mes) | Event-driven arch |
| **NEXT-020** | **IA/ML avançado** — predictive triggers, XGBoost/TensorFlow models | Requisitos.md §3.4-3.5; depende de dados históricos | XL (6-12 mes) | Predição, Diferenciação |

### Quick Wins (Alto Impacto, Baixo Esforço)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| QW-1 | Renomear `hipaaCompliant` → `lgpdCompliant` no schema e migration | 2h | Remove misleading compliance claim |
| QW-2 | Adicionar `algorithm_version` a HealthData, VitalSign, QuestionnaireResponse | 4h | Audit readiness |
| QW-3 | Criar GitHub Actions CI com test + lint + type-check | 4h | CI/CD foundation |
| QW-4 | Gerar OpenAPI/Swagger spec a partir das rotas Express | 4h | API documentation |
| QW-5 | Implementar `INSERT ON CONFLICT DO NOTHING` para whatsappMessageId | 2h | Idempotency |
| QW-6 | Adicionar health check endpoint com verificação de DB + Redis + encrypt | 3h | Observability |
| QW-7 | Trocar package.json description: remover "HIPAA", adicionar "LGPD" | 5min | Truth in advertising |

### Strategic Investments (Alto Esforço, Alto Impacto)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| SI-1 | ANVISA SaMD registration (Classe II/III) | XL (12-18 mes) | Legal operation |
| SI-2 | SBIS certification | L (3-6 mes) | Hospital market access |
| SI-3 | ISO 27001 certification | XL (12-18 mes) | Enterprise credibility |
| SI-4 | Equipe de enfermagem navegadora (24/7) | $$$ (ongoing) | Clinical operations |
| SI-5 | Clinical evidence generation (estudo de acurácia) | L (6-12 mes) | ANVISA, market differentiation |

---

### FIRST THING TO DO

**"What I'd do first"** — Contratar um especialista regulatório ANVISA para classificar a plataforma e, paralelamente, substituir todas as referências a HIPAA por LGPD no código e documentação. Essas duas ações desbloqueiam o caminho legal para processar dados reais de pacientes e eliminam o risco mais grave identificado: claims de compliance enganosos combinados com operação de dispositivo médico potencialmente não registrado. Sem isso, todo o resto é construir sobre fundação ilegal.

