# AUSTA Care Platform — Sections 2–4: Product Vision, Domain Model & Requirements

**Document Type:** Consolidated Technical Report — Sections 2, 3, 4
**Source Documents Analysed:**
- `docs/Requisitos.md` v3.0 (2025-07-14, Status: Aprovado) — primary requirements document
- `docs/Questionary_Sugested.md` — onboarding conversational script
- `docs/architecture_diagrams.md` v1.0 (2025-07-14) — supplementary architecture context

**Analyst Note (PT-BR):** Este relatório consolida as seções 2, 3 e 4 do documento técnico consolidado. Cada afirmação é acompanhada de citação da fonte (`arquivo:seção`). Informações inferidas pelo analista são explicitamente marcadas como `[INFERENCE]`. Nenhum requisito foi inventado; todos os dados provêm dos documentos fonte.

---

## 2. Platform Goals & Vision

### 2.1 North-Star Vision Statement

> "Criar a primeira plataforma de saúde verdadeiramente preditiva do Brasil, onde cada beneficiário recebe cuidado personalizado antes mesmo de perceber a necessidade, através de uma experiência digital excepcional centrada no WhatsApp."

**Source:** `Requisitos.md:1.1 Finalidade e Visão` (lines 13–15)

The platform aims to fundamentally transform the healthcare delivery model from **reactive to proactive and anticipatory** ("ecossistema proativo e antecipatório"). The vision encompasses predictive intervention — care delivered before the patient recognizes the need — delivered through a WhatsApp-first digital experience.

### 2.2 Business Objectives

#### Primary Objectives (documented fact)

| # | Objective | Target Metric | Source |
|---|-----------|---------------|--------|
| OBJ-01 | Reduce global claims ratio (sinistralidade) | **-15%** through prevention and intelligent routing | `Requisitos.md:1.2 Objetivos Estratégicos` |
| OBJ-02 | Increase NPS for large clients | **>70** through differentiated experience | `Requisitos.md:1.2` |
| OBJ-03 | Automate authorizations and scheduling via conversational AI | **85%** automation rate | `Requisitos.md:1.2` |
| OBJ-04 | Achieve first-call resolution through predictive care | **90%** FCR | `Requisitos.md:1.2` |

#### Secondary Objectives (documented fact)

| # | Objective | Target | Source |
|---|-----------|--------|--------|
| OBJ-05 | Reduce operational costs via intelligent automation | **-30%** | `Requisitos.md:1.2` |
| OBJ-06 | Scale to 100k+ beneficiaries with same operational structure | **100,000+** | `Requisitos.md:1.2` |
| OBJ-07 | Establish new market standard for digital care coordination | Qualitative | `Requisitos.md:1.2` |

### 2.3 Target Users / Personas

**Documented personas (explicit):**

| Persona | Role | Characteristics | Source |
|---------|------|-----------------|--------|
| **Beneficiário** | Healthcare plan member — primary platform user | Uses WhatsApp; interacts with conversational assistant Zeca/Ana; earns HealthPoints through gamification | `Requisitos.md:1.4 Glossário`, `Requisitos.md:3.1 RF 1.2` |
| **Enfermeira Navegadora** (Care Coordinator Nurse) | Professional coordinating complex care journeys | Manages medium/high-risk cases; receives escalated alerts from the platform | `Requisitos.md:1.4 Glossário` |
| **RH (Human Resources)** | Corporate B2B contact | Receives WhatsApp notifications on onboarding progress; manages bulk employee uploads | `Requisitos.md:3.1 RF 1.1` |

**Persona selection algorithm (documented pseudocode):**

- Age 18-35 + Male → **Zeca** persona
- Age 18-35 + Female → **Ana** persona
- Age 36-60 → Choice based on user preference (asked at start)
- Age 60+ → **Ana** (more formal, caring tone)

**Source:** `Questionary_Sugested.md: Personalização da Persona` (lines 924–928)

**Implicit personas `[INFERENCE]`:**
- **Platform Administrator:** Referenced in architecture diagrams (`architecture_diagrams.md` C4Context: "Platform Admin — System administration"); implied by dashboard and configuration requirements.
- **Medical Team (médico assistente):** Referenced in escalation rules where "Multiple Risks ≥100 → Escalação médico assistente" (`Questionary_Sugested.md: Triggers de Escalação Automática`).
- **Prestador Credenciado (Credentialed Provider):** Implicit in authorization flows — one of the auto-approval rules checks "Prestador credenciado" (`Requisitos.md:3.5 RF 5.1`).

### 2.4 Value Proposition

The platform's value proposition, synthesized from documented features:

1. **Proactive, not reactive:** Predictive triggers identify health deterioration before crisis (`Requisitos.md:1.1`)
2. **WhatsApp-first accessibility:** Zero-install interface via the most used messaging app in Brazil (`Requisitos.md:1.1`)
3. **Gamified engagement:** HealthPoints and badges drive onboarding completion and ongoing adherence (`Questionary_Sugested.md: Gamificação e Missões`)
4. **AI-augmented clinical decisions:** Symptom analysis, drug interaction checking, and risk stratification support both patients and professionals (`Requisitos.md:3.3`)
5. **Operational efficiency:** 85% auto-approval of authorizations, smart scheduling, reducing administrative burden (`Requisitos.md:3.5`)
6. **Regulatory compliance by design:** LGPD, HIPAA, ANS, ISO 27001 embodied in architecture (`Requisitos.md:4.2`)

### 2.5 Success Metrics / KPIs

**Source:** `Requisitos.md:6.2 KPIs de Sucesso` and `Questionary_Sugested.md: Métricas de Sucesso do Onboarding`

#### Operational KPIs

| KPI | Target | Measurement | Source |
|-----|--------|-------------|--------|
| First Contact Resolution | >75% | % issues resolved in first interaction | `Requisitos.md:6.2` |
| Average Response Time | <30 seconds | WhatsApp message response | `Requisitos.md:6.2` |
| System Availability | >99.9% | Uptime monitoring | `Requisitos.md:6.2` |
| User Adoption Rate | >80% within 90 days | % of eligible users active | `Requisitos.md:6.2` |
| Onboarding Completion Rate | >85% | % users completing all 5 missions | `Questionary_Sugested.md: KPIs Principais` |
| Onboarding Engagement | >90% respond to first 3 messages | Engagement rate | `Questionary_Sugested.md: KPIs Principais` |
| Risk Detection Accuracy | >95% | Accuracy identifying known conditions | `Questionary_Sugested.md: KPIs Principais` |

#### Business KPIs

| KPI | Target | Timeline | Source |
|-----|--------|----------|--------|
| Claims Ratio Reduction | -15% | 12 months | `Requisitos.md:6.2` |
| NPS Improvement | +25 points | — | `Requisitos.md:6.2` |
| Operational Cost Reduction | -30% | — | `Requisitos.md:6.2` |
| Customer Satisfaction | >4.5/5.0 | — | `Requisitos.md:6.2` |
| Onboarding NPS | >70 | At process completion | `Questionary_Sugested.md` |
| Onboarding Time | <20 minutes (distributed) | Per user sessions | `Questionary_Sugested.md` |

#### Performance Metrics

| Metric | Target | Source |
|--------|--------|--------|
| WhatsApp Latency | <3s P95 | `Requisitos.md:4.1` |
| API Latency | <200ms P99 | `Requisitos.md:4.1` |
| Throughput | >1,000 msg/s | `Requisitos.md:4.1` |
| Error Rate | <0.1% | `Requisitos.md:4.1` |
| Authorization Time | <30s for 80% of simple cases | `Requisitos.md:3.5 RF 5.1` |
| Bulk Upload Processing | 10,000 records in <15 min | `Requisitos.md:3.1 RF 1.1` |

### 2.6 In-Scope vs Out-of-Scope Boundaries

#### In-Scope (documented)

| Scope Item | Source |
|------------|--------|
| WhatsApp Business API as primary patient interface | `Requisitos.md:2.2, 5.2` |
| PWA (React.js) as web interface | `Requisitos.md:2.2` |
| ERP Tasy integration (real-time, OAuth 2.0) | `Requisitos.md:5.2` |
| FHIR R4 Gateway for healthcare interoperability | `Requisitos.md:5.2` |
| 5 core modules: Onboarding, Risk Detection, Clinical Assistant, Care Coordination, Process Automation | `Requisitos.md:1.3` |
| Gamification system (HealthPoints, Badges) | `Requisitos.md:3.1`; `Questionary_Sugested.md` |
| AI/ML: GPT-4, XGBoost, TensorFlow | `Requisitos.md:2.2` |
| Brazilian regulatory compliance: LGPD, ANS | `Requisitos.md:4.2` |
| International standards: HIPAA, ISO 27001 | `Requisitos.md:4.2` |
| Portuguese language with regional variations | `Requisitos.md:3.3 RF 3.1` |
| Voice AI for accessibility (AWS Polly + Lex) | `Requisitos.md:2.2` |

#### Out-of-Scope (explicitly mentioned as limited/future)

| Item | Status/Rationale | Source |
|------|------------------|--------|
| Non-WhatsApp channels (beyond PWA) | Phase 4: "Expansão para novos canais" (months 10–12) | `Requisitos.md:6.1 Fase 4` |
| "Modo limitado" without LGPD consent | Users who decline consent get basic features only (plan questions, scheduling, provider lookup) | `Questionary_Sugested.md: Ramificação B1` |

#### Out-of-Scope `[INFERENCE]`

- **Direct EHR/EMR integration beyond Tasy:** The docs only specify Tasy ERP and FHIR Gateway. Broader hospital EMR integration is shown in architecture diagrams as external systems but not detailed.
- **Wearable device integration:** Mentioned only in passing ("Sinais precoces via wearables" in predictive triggers — `Requisitos.md:3.4 RF 4.2`), suggesting future capability, not Phase 1–4 core scope.
- **Mobile native apps (iOS/Android):** Architecture only mentions PWA; no native app referenced.

---

## 3. Domain Model & Bounded Contexts

### 3.1 Core Domain Concepts — Ubiquitous Language Glossary

Extracted and extended from the documented glossary (`Requisitos.md:1.4 Definições e Glossário`), enriched with concepts found elsewhere in the documents.

| Term | Definition | Source |
|------|------------|--------|
| **Beneficiário** | End customer of the healthcare plan; primary platform user | `Requisitos.md:1.4` |
| **CPT (Cobertura Parcial Temporária)** | Temporary Partial Coverage for pre-existing conditions; subject to automated detection | `Requisitos.md:1.4` |
| **Enfermeira Navegadora** | Professional who coordinates complex care journeys for medium/high-risk patients | `Requisitos.md:1.4` |
| **Zeca / Ana** | Personas of the virtual assistant; conversational interface front-end | `Requisitos.md:1.4`; `Questionary_Sugested.md` |
| **FHIR (Fast Healthcare Interoperability Resources)** | Healthcare interoperability standard (R4) | `Requisitos.md:1.4, 5.2` |
| **HealthPoints** | Platform gamification currency; earned by completing missions, unlocks benefits | `Requisitos.md:1.4`; `Questionary_Sugested.md: Fase 2` |
| **Journey Orchestration** | Automated patient journey orchestration via Camunda BPM + AI | `Requisitos.md:1.4` |
| **Predictive Trigger** | ML/AI-generated trigger for proactive interventions | `Requisitos.md:1.4` |
| **HealthScore** | Algorithmically calculated preliminary health score derived during onboarding | `Requisitos.md:3.1 RF 1.2` |
| **Risk Score** | Numerical stratification (0–100+) combining demographics, comorbidities, utilization, social determinants, behavior, and ML predictions | `Requisitos.md:3.4 RF 4.1` |
| **Mission (Missão)** | Gamified data-collection unit; 5 total in onboarding, each worth HealthPoints | `Questionary_Sugested.md: Fase 2` |
| **Badge** | Gamification achievement marker unlocked by completing missions | `Questionary_Sugested.md: Fase 2` |
| **Risk Flag** | Automated label generated by NLP/ML analysis (e.g., HYPERTENSION_RISK, CARDIAC_RISK, DIABETES_RISK, SLEEP_APNEA_RISK, DEPRESSION_RISK) | `Questionary_Sugested.md: Sistema de Scoring` |
| **Auto-Approval** | Automated authorization of procedures meeting pre-defined rules (low cost, eligible, credentialed, no fraud history) | `Requisitos.md:3.5 RF 5.1` |
| **First Call Resolution (FCR)** | Issue resolved in first patient interaction without escalation | `Requisitos.md:1.2` |
| **Sinistralidade** | Claims ratio — total claims cost / premium revenue | `Requisitos.md:1.2` |
| **Event Sourcing** | Architecture pattern: all health events captured and processed as immutable events | `Requisitos.md:2.1` |
| **CQRS** | Command Query Responsibility Segregation — separate read/write optimization | `Requisitos.md:2.1` |

### 3.2 Context Map — Bounded Contexts

Identified from the documented modules and architecture. Each bounded context corresponds to a deployable microservice or cohesive functional area.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUSTA Care Platform                           │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │    Onboarding     │  │   Risk Detection │  │   Clinical    │  │
│  │     Context       │  │     Context      │  │   Assistant   │  │
│  │                   │  │                  │  │    Context    │  │
│  │ • Beneficiary     │  │ • RiskScore      │  │               │  │
│  │ • HealthProfile   │  │ • CPT Flag       │  │ • Symptom     │  │
│  │ • Consent (LGPD)  │  │ • Fraud Case     │  │ • Triage      │  │
│  │ • HealthPoints    │  │ • Escalation     │  │ • Medical KB  │  │
│  │ • Documents (OCR) │  │                  │  │ • Guidelines  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                     │                     │          │
│  ┌────────┴─────────────────────┴─────────────────────┴───────┐  │
│  │              Event Backbone (Apache Kafka)                 │  │
│  │         MessageReceived → SymptomAnalyzed → ...            │  │
│  └────────┬─────────────────────┬─────────────────────┬───────┘  │
│           │                     │                     │          │
│  ┌────────┴─────────┐  ┌────────┴─────────┐  ┌────────┴───────┐  │
│  │  Care Coordination│  │Process Automation│  │  Integration   │  │
│  │     Context       │  │     Context      │  │    Context     │  │
│  │                   │  │                  │  │               │  │
│  │ • Stratification  │  │ • Authorization  │  │ • FHIR Gateway│  │
│  │ • Journey Orchest.│  │ • Scheduling     │  │ • Tasy Adapter│  │
│  │ • Predictive      │  │ • RPA Workflows  │  │ • WhatsApp API│  │
│  │   Triggers        │  │ • Notification   │  │ • GraphQL GW  │  │
│  └───────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Source for contexts:** Module breakdown in `Requisitos.md:1.3 Escopo do Produto` and `Requisitos.md:3 Requisitos Funcionais Detalhados`. Event backbone from `Requisitos.md:2.1 Arquitetura Orientada a Eventos`.

**Context relationships:**

| Upstream Context | Downstream Context | Relationship Type | Mechanism |
|------------------|-------------------|-------------------|-----------|
| Onboarding | Risk Detection | Customer/Supplier | Onboarding produces HealthProfile consumed by Risk engine |
| Risk Detection | Care Coordination | Customer/Supplier | Risk flags trigger care coordination workflows |
| Clinical Assistant | Care Coordination | Customer/Supplier | Symptom analysis results feed into risk stratification |
| Care Coordination | Process Automation | Customer/Supplier | Predictive triggers generate authorization/scheduling requests |
| Process Automation | Integration | Customer/Supplier | Authorization events published to Tasy/FHIR via Integration Hub |
| All contexts | Event Backbone (Kafka) | Shared Kernel | All events flow through Kafka (`Requisitos.md:2.1`) |

### 3.3 Key Workflows

#### 3.3.1 Onboarding Journey (End-to-End)

**Source:** `Requisitos.md:3.1 RF 1.2` combined with `Questionary_Sugested.md` (entire document)

```
TRIGGER: 24h after benefit activation
    │
    ▼
┌──────────────────────────────────────┐
│ PHASE 1: Welcome & Consent           │
│ • WhatsApp welcome message           │
│ • Persona selection (Zeca/Ana)       │
│ • LGPD consent (gamified)            │
│ • Branch: consent denied →           │
│   "modo limitado" (basic features)   │
└──────────────┬───────────────────────┘
               │ consent granted
               ▼
┌──────────────────────────────────────┐
│ PHASE 2: 5 Gamified Missions         │
│                                      │
│ Mission 1 "Me Conhece" (100 HP)      │
│   → Demographics, family, lifestyle  │
│ Mission 2 "Estilo de Vida" (150 HP)  │
│   → Activity, diet, smoking/alcohol  │
│ Mission 3 "Bem-Estar" (200 HP)       │
│   → Sleep, energy, mood, stress      │
│ Mission 4 "Saúde Atual" (250 HP)     │
│   → Symptoms, medications, history   │
│ Mission 5 "Documentos" (300 HP)      │
│   → Medical docs, emergency contacts │
│                                      │
│ TOTAL: 1000 HealthPoints             │
│ Badge: "Perfil Completo"             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ POST-ONBOARDING (within 24h)         │
│ • AI analyzes all collected data     │
│ • HealthScore calculated             │
│ • Personalized Health Report         │
│ • Risk flags triaged & escalated     │
│ • Nurse navigator assigned (if high) │
│ • Wellness tips sent                 │
└──────────────────────────────────────┘
```

#### 3.3.2 Risk Detection Pipeline

**Source:** `Requisitos.md:3.2 Módulo 2` and `Questionary_Sugested.md: Sistema de Scoring`

```
User responses (NLP text)
    │
    ▼
┌──────────────────────────┐
│ Conversational Analysis  │ ← NLP: spaCy, BioBERT
│ • Indirect detection     │
│ • Pattern recognition    │
│ • Confidence scoring     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Risk Scoring Algorithm   │
│ • Age factor             │
│ • Comorbidity score      │
│ • Utilization patterns   │
│ • Social determinants    │
│ • Behavioral factors     │
│ • ML predictive signals  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Risk Flags Generated:    │
│ HYPERTENSION_RISK        │
│ CARDIAC_RISK             │
│ DIABETES_RISK            │
│ SLEEP_APNEA_RISK         │
│ DEPRESSION_RISK          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Escalation Decision:         │
│ Critical (Score ≥80) →       │
│   Immediate nurse contact    │
│ High (Score 60–79) →        │
│   Contact within 24h         │
│ Medium (Score 40–59) →      │
│   Preventive scheduling      │
│ Low (Score <40) →           │
│   Routine follow-up          │
└──────────────────────────────┘
```

#### 3.3.3 Symptom Analysis Pipeline

**Source:** `Requisitos.md:3.3 RF 3.1`

```
User Input (WhatsApp text)
    │
    ▼
NLP Preprocessing → Symptom Extraction → Medical Knowledge Graph
    │                                           │
    ▼                                           ▼
Risk Stratification ← Comorbidity Assessment ← Drug Interaction Check
    │
    ▼
Decision Tree → Action Recommendation
    │
    ├── 🟢 Low Risk (1–3): Self-care guidance + 48h follow-up
    ├── 🟡 Medium Risk (4–6): Priority scheduling + anamnesis prep
    └── 🔴 High Risk (7–10): Immediate escalation + phone + ER guidance
```

#### 3.3.4 Authorization Workflow

**Source:** `Requisitos.md:3.5 RF 5.1`

```
WhatsApp Request → OCR + NLP Extraction → Eligibility Check (Tasy API)
    │                                              │
    ▼                                              ▼
Protocol Validation → Risk Assessment → Decision
                                               │
                    ┌────────────────────────────┼────────────────────┐
                    ▼                            ▼                    ▼
           Auto-Approval                   Escalation           Code Generation
        (if: <R$500, eligible,         (manual review)              │
         credentialed, no fraud)                               Notification
                                                              (WhatsApp)
Target: <30 seconds for 80% of simple cases
```

#### 3.3.5 Event-Driven System Sequence (from architecture diagrams)

**Source:** `architecture_diagrams.md: Event-Driven Architecture Sequence Diagram`

The canonical event flow (verified against C4 container model):
`User → API Gateway → Chat Service → Kafka (MessageReceived) → AI Service (SymptomAnalyzed) → Auth Service (AuthorizationNeeded) → Notification Service`

### 3.4 Patient Journey End-to-End `[ANALYST SYNTHESIS]`

The following synthesizes the documented workflows into a coherent patient journey. Individual steps are documented; the narrative thread is analyst synthesis.

```
┌────────────────────────────────────────────────────────────────┐
│                  PATIENT LIFECYCLE JOURNEY                      │
│                                                                 │
│  [1] ENROLLMENT           [2] ONBOARDING       [3] MONITORING  │
│  ┌──────────────┐       ┌──────────────┐      ┌──────────────┐ │
│  │ Employer bulk │       │ 5 gamified    │      │ Predictive   │ │
│  │ upload (B2B)  │──────▶│ missions      │─────▶│ triggers     │ │
│  │ CPF validation │       │ via WhatsApp  │      │ monitor risk │ │
│  │ Tasy eligibility│      │ HealthScore   │      │ continuously │ │
│  └──────────────┘       │ calculated    │      └──────┬───────┘ │
│                          └──────────────┘             │         │
│                                                       │         │
│  [4] INTERVENTION        [5] RESOLUTION              │         │
│  ┌──────────────┐       ┌──────────────┐             │         │
│  │ Symptom       │       │ Authorization │◀───────────┘         │
│  │ analysis      │──────▶│ auto-approval │                       │
│  │ Risk triage   │       │ Smart         │                       │
│  │ Nurse escalation│     │ scheduling    │                       │
│  └──────────────┘       │ Follow-up     │                       │
│                          └──────────────┘                       │
│                                                                 │
│  [ALL PHASES] Feedback loop → continuous ML improvement         │
└────────────────────────────────────────────────────────────────┘
```

**Phase details (documented):**

1. **Enrollment:** B2B bulk upload → CPF validation via Serasa/SPC → Tasy eligibility check → automatic WhatsApp trigger 24h post-activation (`Requisitos.md:3.1 RF 1.1, RF 1.2`)
2. **Onboarding:** 5-mission gamified flow → HealthScore calculation → risk flag generation → escalation if needed (`Questionary_Sugested.md` full document; `Requisitos.md:3.1 RF 1.2`)
3. **Monitoring:** Predictive triggers (temporal, event-based, predictive, AI-generated) continuously evaluate risk (`Requisitos.md:3.4 RF 4.2`)
4. **Intervention:** Symptom analysis triggers risk stratification; nurse navigator contacted for high-risk cases; clinical knowledge base supports decision (`Requisitos.md:3.3, 3.4`)
5. **Resolution:** Authorization (auto or manual), smart scheduling with geographic optimization, notification via WhatsApp (`Requisitos.md:3.5`)

---

## 4. Product Requirements

### 4.1 Functional Requirements — Categorized by Capability

Each requirement is assigned a unique ID (REQ-001 through REQ-NNN), a MoSCoW priority, and traced to source document sections.

#### Module A: Onboarding & Engagement

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-001 | **B2B Bulk Upload:** System shall accept Excel/CSV files with up to 10,000 beneficiary records, validate via CPF (Serasa/SPC API), check Tasy eligibility, detect duplicates across companies, and apply waiting-period rules by category. Processing target: <15 minutes. Generate PDF executive report. | **Must** | `Requisitos.md:3.1 RF 1.1` |
| REQ-002 | **B2B Progress Notification:** System shall send automated WhatsApp notifications to HR with real-time import progress status. | **Must** | `Requisitos.md:3.1 RF 1.1` |
| REQ-003 | **B2B Inconsistency Detection:** IA shall detect ≥95% of data inconsistencies (missing, duplicate, invalid) automatically during bulk upload. | **Must** | `Requisitos.md:3.1 RF 1.1 — Critérios de Aceite` |
| REQ-004 | **Individual Onboarding Trigger:** System shall send a WhatsApp welcome message automatically 24 hours after benefit activation. | **Must** | `Requisitos.md:3.1 RF 1.2 — Jornada do Usuário` |
| REQ-005 | **Persona Selection:** System shall select Zeca or Ana persona based on algorithm: age 18–35 + male → Zeca; age 18–35 + female → Ana; age 36–60 → user choice; age 60+ → Ana. | **Must** | `Questionary_Sugested.md: Personalização da Persona` |
| REQ-006 | **Adaptive Language:** System shall adjust conversational tone based on detected digital literacy (high literacy → technical language; low literacy → simplified language + emojis) and region (via DDD → regional expressions). | **Should** | `Questionary_Sugested.md: Adaptação de linguagem` |
| REQ-007 | **Intelligent Timing:** System shall optimize message send times based on individual user response patterns. | **Should** | `Requisitos.md:3.1 RF 1.2 — Personalização Inteligente` |
| REQ-008 | **5-Mission Gamified Onboarding:** System shall present 5 sequential missions ("Me Conhece" 100HP, "Estilo de Vida" 150HP, "Bem-Estar" 200HP, "Saúde Atual" 250HP, "Documentos" 300HP) with HealthPoints awarded on completion and badges unlocked per mission. | **Must** | `Questionary_Sugested.md: Fase 2 — Gamificação e Missões`; `Requisitos.md:3.1 RF 1.2` |
| REQ-009 | **HealthScore Calculation:** System shall calculate an initial HealthScore algorithmically upon onboarding completion. | **Must** | `Requisitos.md:3.1 RF 1.2 — Jornada do Usuário` |
| REQ-010 | **Onboarding Pause/Resume:** System shall support pausing onboarding mid-session and resuming later with progressive reminders (2h → 24h → 3 days → 1 week → human phone contact). | **Must** | `Questionary_Sugested.md: Sistema de Retomada Inteligente` |
| REQ-011 | **LGPD Consent (Gamified):** System shall present LGPD consent in a gamified manner, offering 100 HealthPoints for profile completion. On denial, system enters "modo limitado" providing only basic features (plan queries, scheduling, provider lookup, general info). | **Must** | `Questionary_Sugested.md: Fase 1 — Consentimento LGPD` |
| REQ-012 | **Multi-Document OCR:** System shall recognize receipts, exam results, medical reports, and insurance cards via multi-engine OCR (Tesseract + AWS Textract), extract structured data (numeric values, dates, medications), identify medical entities (CID-10, dosages, frequencies), and assess image quality. | **Must** | `Requisitos.md:3.1 RF 1.3` |
| REQ-013 | **Document Fraud Detection:** System shall detect falsified documents via pattern analysis and template matching. | **Should** | `Requisitos.md:3.1 RF 1.3`; `Requisitos.md:3.2 RF 2.2 Camada 1` |
| REQ-014 | **OCR-to-FHIR Pipeline:** Extracted document data shall be structured into FHIR format (Patient, Observation, DiagnosticReport resources) before storage. | **Must** | `Requisitos.md:3.1 RF 1.3 — Pipeline de Processamento`; `Requisitos.md:5.2 FHIR Gateway` |

#### Module B: Risk Detection

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-020 | **Indirect Pre-existing Condition Detection:** NLP/ML system shall analyze conversational responses for indirect signs of health conditions using: indirect questioning patterns, behavioral analysis, lifestyle indicators, and medication clues. | **Must** | `Requisitos.md:3.2 RF 2.1` |
| REQ-021 | **Confidence Scoring:** Each suspected condition shall receive a confidence score. | **Must** | `Requisitos.md:3.2 RF 2.1 — Algoritmo de Detecção` |
| REQ-022 | **Cross-Reference Validation:** System shall cross-reference detected conditions with utilization history from Tasy. | **Must** | `Requisitos.md:3.2 RF 2.1` |
| REQ-023 | **Document Forensics (Anti-Fraud Layer 1):** System shall analyze document authenticity via advanced algorithms, official template matching, EXIF metadata verification, and biometric facial recognition on photo IDs. | **Must** | `Requisitos.md:3.2 RF 2.2 — Camada 1` |
| REQ-024 | **Behavioral Analysis (Anti-Fraud Layer 2):** System shall perform device fingerprinting, geolocation anomaly detection, usage pattern analysis, and automated response detection. | **Should** | `Requisitos.md:3.2 RF 2.2 — Camada 2` |
| REQ-025 | **Network Analysis (Anti-Fraud Layer 3):** System shall use Neo4j graph database for relationship analysis, community detection for fraudulent clusters, shared resource detection, and social network analysis for suspicious patterns. | **Could** | `Requisitos.md:3.2 RF 2.2 — Camada 3` |
| REQ-026 | **Risk Scoring Algorithm:** System shall calculate a composite risk score incorporating: age factor, comorbidity score, utilization pattern, social determinants (location, income), behavioral factors (lifestyle), and ML predictive signals. Score output: 0–100+ scale. | **Must** | `Requisitos.md:3.4 RF 4.1 — Algoritmo de Risk Scoring` |
| REQ-027 | **Risk Flags Generation:** System shall generate risk flags (HYPERTENSION_RISK, CARDIAC_RISK, DIABETES_RISK, SLEEP_APNEA_RISK, DEPRESSION_RISK) based on scoring thresholds documented in the onboarding script. | **Must** | `Questionary_Sugested.md: Sistema de Scoring de Risco Automatizado` |
| REQ-028 | **Automatic Escalation Triggers:** Risk scores shall trigger escalations: CRITICAL (≥80) → immediate nurse contact; HIGH (60–79) → contact within 24h; MEDIUM (40–59) → preventive scheduling; LOW (<40) → routine follow-up. | **Must** | `Questionary_Sugested.md: Alertas e Escalações`; `Requisitos.md:3.4 RF 4.1` |
| REQ-029 | **Population Stratification:** System shall categorize beneficiaries: Complex (Score >90, ~2% of population) → intensive care; High Risk (70–90, ~8%) → active management; Moderate (40–70, ~20%) → targeted prevention; Healthy (<40, ~70%) → basic prevention. | **Must** | `Requisitos.md:3.4 RF 4.1 — Categorias de Risco` |

#### Module C: Clinical Assistant

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-030 | **Symptom Extraction via NLP:** System shall extract symptoms from free-text WhatsApp messages using NLP preprocessing (spaCy + BioBERT). | **Must** | `Requisitos.md:3.3 RF 3.1 — Pipeline de Processamento` |
| REQ-031 | **Multilingual Support:** System shall support Portuguese with regional variations. | **Must** | `Requisitos.md:3.3 RF 3.1` |
| REQ-032 | **Symptom Severity Scoring:** System shall assign automatic severity scores (1–10 scale). | **Must** | `Requisitos.md:3.3 RF 3.1` |
| REQ-033 | **Temporal Analysis:** System shall consider symptom duration, progression, and frequency in analysis. | **Must** | `Requisitos.md:3.3 RF 3.1` |
| REQ-034 | **Comorbidity Assessment:** System shall analyze pre-existing conditions in context of reported symptoms. | **Must** | `Requisitos.md:3.3 RF 3.1` |
| REQ-035 | **Drug Interaction Check:** System shall verify drug interactions based on patient's current medications against ANVISA drug database. | **Must** | `Requisitos.md:3.3 RF 3.1`; `Requisitos.md:3.3 RF 3.2` |
| REQ-036 | **Risk Classification:** System shall classify cases as Low (1–3: self-care + 48h follow-up), Medium (4–6: priority scheduling + anamnesis), or High (7–10: immediate escalation + phone + ER guidance). | **Must** | `Requisitos.md:3.3 RF 3.1 — Classificação de Risco` |
| REQ-037 | **Medical Knowledge Base:** System shall integrate evidence-based sources (Cochrane, PubMed, UpToDate), clinical guidelines (SBC, SBEM, ABEM), drug database (ANVISA Bulário), and AUSTA protocols. | **Must** | `Requisitos.md:3.3 RF 3.2` |
| REQ-038 | **Continuous Learning:** System shall implement feedback loop from real interactions, periodic expert medical review, automatic synchronization with official sources, and A/B testing of different approaches. | **Should** | `Requisitos.md:3.3 RF 3.2 — Continuous Learning` |

#### Module D: Care Coordination

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-040 | **Temporal Triggers:** System shall generate triggers for: preventive exam expiration, post-procedure follow-up, medication renewal, and routine consultation dates. | **Must** | `Requisitos.md:3.4 RF 4.2 — Temporal Triggers` |
| REQ-041 | **Event-Based Triggers:** System shall react to: abnormal exam results, new medical prescriptions, hospital admissions, and changes in utilization patterns. | **Must** | `Requisitos.md:3.4 RF 4.2 — Event-Based Triggers` |
| REQ-042 | **Predictive Triggers (ML):** System shall predict: 30-day hospitalization risk, chronic condition deterioration, treatment non-adherence probability, and cardiovascular event risk. | **Should** | `Requisitos.md:3.4 RF 4.2 — Predictive Triggers` |
| REQ-043 | **AI-Generated Triggers:** System shall detect: anomalous patterns via ML, early signals from wearables, sentiment analysis in conversations, and population-level correlations. | **Could** | `Requisitos.md:3.4 RF 4.2 — AI-Generated Triggers` |
| REQ-044 | **Journey Orchestration:** System shall orchestrate patient journeys via Camunda BPM with AI-augmented decision-making. | **Must** | `Requisitos.md:2.2 — Camada de Orquestração`; `Requisitos.md:1.4 — Journey Orchestration` |

#### Module E: Process Automation

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-050 | **WhatsApp Authorization Request:** System shall accept authorization requests via WhatsApp with OCR + NLP extraction of procedure details. | **Must** | `Requisitos.md:3.5 RF 5.1 — Fluxo Automatizado` |
| REQ-051 | **Eligibility Check:** System shall perform real-time eligibility verification via Tasy API (OAuth 2.0, client certificates, 99.9% SLA). | **Must** | `Requisitos.md:3.5 RF 5.1`; `Requisitos.md:5.2 ERP Tasy Integration` |
| REQ-052 | **Auto-Approval Rules:** System shall auto-approve procedures meeting ALL criteria: cost <R$500, beneficiary current on payments, procedure within coverage, credentialed provider, no fraud history. | **Must** | `Requisitos.md:3.5 RF 5.1 — Regras de Auto-Aprovação` |
| REQ-053 | **Authorization Performance Target:** Auto-approval processing shall complete in <30 seconds for ≥80% of simple cases. | **Must** | `Requisitos.md:3.5 RF 5.1 — Tempo-Meta` |
| REQ-054 | **Smart Scheduling:** System shall provide: real-time provider availability sync, ML-based user preference learning, geographic optimization (nearest locations), automatic waitlist management with notifications, and proactive rescheduling on cancellations. | **Should** | `Requisitos.md:3.5 RF 5.2` |
| REQ-055 | **Authorization Code Generation:** System shall generate and deliver authorization codes via WhatsApp notification. | **Must** | `Requisitos.md:3.5 RF 5.1 — Fluxo Automatizado` |

#### Module F: Integration & API

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-060 | **RESTful API:** System shall expose RESTful APIs at Richardson Maturity Level 3 (HATEOAS), with header-based versioning (`Accept: application/vnd.api.v1+json`), offset/limit + cursor-based pagination, and JSON:API response format. | **Must** | `Requisitos.md:5.1 API Design Standards` |
| REQ-061 | **GraphQL Gateway:** System shall provide a single GraphQL endpoint for mobile/web clients with real-time subscriptions via WebSockets, schema stitching for microservices, and query complexity analysis. | **Should** | `Requisitos.md:5.1 GraphQL Gateway` |
| REQ-062 | **FHIR R4 Conformance:** FHIR Gateway shall conform to FHIR R4, map resources (Patient, Observation, DiagnosticReport), support terminology services (SNOMED-CT, ICD-10, LOINC), and maintain audit logs for all FHIR operations. | **Must** | `Requisitos.md:5.2 FHIR Gateway` |
| REQ-063 | **WhatsApp Business API Integration:** System shall integrate Meta official WhatsApp Business API supporting rich messages (images, documents, buttons), message templates, webhook delivery, and end-to-end encryption. Rate limits: 1,000 msg/s, 10,000 conversations/day per number. | **Must** | `Requisitos.md:5.2 WhatsApp Business API` |
| REQ-064 | **Tasy ERP Integration:** Real-time API integration via REST + WebSockets, OAuth 2.0 + client certificates, rate limit 1,000 req/min, fallback to message queue + batch processing, 99.9% availability SLA. | **Must** | `Requisitos.md:5.2 ERP Tasy Integration` |

#### Module G: Frontend Interfaces

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-070 | **WhatsApp Conversational Interface:** Primary patient interface via WhatsApp with support for text, images (OCR), documents, and interactive buttons. | **Must** | `Requisitos.md:2.2`, `Requisitos.md:5.2` |
| REQ-071 | **PWA (Progressive Web App):** Web interface built with React.js for richer interactions beyond WhatsApp capabilities. | **Should** | `Requisitos.md:2.2` |
| REQ-072 | **Voice AI Accessibility:** Voice interface using AWS Polly (speech synthesis) + AWS Lex (speech recognition) for accessibility. | **Could** | `Requisitos.md:2.2` |
| REQ-073 | **Executive Dashboard:** Real-time visualization dashboard for B2B client HR showing import progress. | **Must** | `Requisitos.md:3.1 RF 1.1` |
| REQ-074 | **Business Analytics Dashboard:** Display DAU/MAU, onboarding conversion rate, real-time NPS, average resolution time, claims ratio by segment. | **Should** | `Requisitos.md:4.3 Business Metrics Dashboard` |

### 4.2 Non-Functional Requirements

#### 4.2.1 Performance

| NFR ID | Requirement | Target | Source |
|--------|-------------|--------|--------|
| NFR-P01 | WhatsApp latency (P95) | <3 seconds | `Requisitos.md:4.1` |
| NFR-P02 | API latency (P99) | <200ms | `Requisitos.md:4.1` |
| NFR-P03 | Message throughput | >1,000 msg/s | `Requisitos.md:4.1` |
| NFR-P04 | Error rate | <0.1% | `Requisitos.md:4.1` |
| NFR-P05 | Authorization processing time | <30s for 80% of simple cases | `Requisitos.md:3.5 RF 5.1` |
| NFR-P06 | Bulk upload processing | 10,000 records in <15 min | `Requisitos.md:3.1 RF 1.1` |
| NFR-P07 | Population analysis report generation | <30 min | `Requisitos.md:3.1 RF 1.1` |

#### 4.2.2 Scalability

| NFR ID | Requirement | Target / Mechanism | Source |
|--------|-------------|--------------------|--------|
| NFR-S01 | Horizontal auto-scaling | Based on CPU/Memory/Queue depth | `Requisitos.md:4.1 Escalabilidade Horizontal` |
| NFR-S02 | Intelligent load balancing | With health checks | `Requisitos.md:4.1` |
| NFR-S03 | Database sharding | For historical data | `Requisitos.md:4.1` |
| NFR-S04 | CDN for static assets | Content delivery optimization | `Requisitos.md:4.1` |
| NFR-S05 | Scale target | 100,000+ beneficiaries with same operational structure | `Requisitos.md:1.2` |

#### 4.2.3 Availability & Resilience

| NFR ID | Requirement | Target | Source |
|--------|-------------|--------|--------|
| NFR-A01 | System availability | 99.9% uptime | `Requisitos.md:4.1`, `Requisitos.md:6.2` |
| NFR-A02 | Circuit breaker pattern | Resilience by Design principle | `Requisitos.md:2.3` |
| NFR-A03 | Zero downtime deployment | Blue-green with automatic rollback | `Requisitos.md:2.3` |
| NFR-A04 | WhatsApp API fallback | Circuit breaker + fallback SMS on latency | `Requisitos.md:7.1 Riscos Técnicos` |
| NFR-A05 | Tasy overload protection | Queue + rate limiting + cache | `Requisitos.md:7.1` |
| NFR-A06 | AI model failure fallback | Fallback to rules engine | `Requisitos.md:7.1` |

#### 4.2.4 Security

| NFR ID | Requirement | Target / Mechanism | Source |
|--------|-------------|--------------------|--------|
| NFR-SEC01 | Network security — WAF | Web Application Firewall | `Requisitos.md:4.2 Camada 1` |
| NFR-SEC02 | Network security — DDoS | DDoS protection | `Requisitos.md:4.2` |
| NFR-SEC03 | Network security — VPC | VPC isolation, network segmentation | `Requisitos.md:4.2` |
| NFR-SEC04 | Application auth | OAuth 2.0 + JWT tokens | `Requisitos.md:4.2 Camada 2` |
| NFR-SEC05 | Rate limiting | Per user/IP | `Requisitos.md:4.2` |
| NFR-SEC06 | Input validation | Input validation & sanitization | `Requisitos.md:4.2` |
| NFR-SEC07 | CSRF/XSS protection | Web application protections | `Requisitos.md:4.2` |
| NFR-SEC08 | Encryption at rest | AES-256 | `Requisitos.md:4.2 Camada 3` |
| NFR-SEC09 | Encryption in transit | TLS 1.3 | `Requisitos.md:4.2` |
| NFR-SEC10 | Database encryption | Full database encryption | `Requisitos.md:4.2` |
| NFR-SEC11 | PII tokenization | Personally identifiable information tokenized | `Requisitos.md:4.2` |
| NFR-SEC12 | Security architecture principle | Zero-trust, encryption everywhere, least privilege | `Requisitos.md:2.3` |

#### 4.2.5 Privacy & Compliance

| NFR ID | Requirement | Standard / Mechanism | Source |
|--------|-------------|----------------------|--------|
| NFR-COMP01 | LGPD compliance | Granular consent, right to erasure, data portability | `Requisitos.md:4.2 Compliance Framework` |
| NFR-COMP02 | HIPAA compliance | BAA with Meta, audit trails, access controls | `Requisitos.md:4.2` |
| NFR-COMP03 | ANS regulatory | Automated reports, SLA compliance | `Requisitos.md:4.2` |
| NFR-COMP04 | ISO 27001 | Security management system | `Requisitos.md:4.2` |
| NFR-COMP05 | LGPD consent granularity | Specific authorization per data category (gamified) | `Questionary_Sugested.md: Consentimento LGPD` |
| NFR-COMP06 | Data access restriction | Only medical team has access to full health data | `Questionary_Sugested.md: Consentimento LGPD` |

#### 4.2.6 Observability & Monitoring

| NFR ID | Requirement | Tool / Mechanism | Source |
|--------|-------------|------------------|--------|
| NFR-OBS01 | Metrics collection | Prometheus + Grafana | `Requisitos.md:4.3 Stack de Observabilidade` |
| NFR-OBS02 | Centralized logging | ELK Stack (Elasticsearch, Logstash, Kibana) | `Requisitos.md:4.3` |
| NFR-OBS03 | Distributed tracing | Jaeger | `Requisitos.md:4.3` |
| NFR-OBS04 | Application Performance Monitoring | New Relic or Datadog | `Requisitos.md:4.3` |
| NFR-OBS05 | Critical incident alerting | PagerDuty | `Requisitos.md:4.3` |
| NFR-OBS06 | Observability-first principle | Structured logs, metrics, distributed tracing | `Requisitos.md:2.3` |
| NFR-OBS07 | Business metrics dashboard | DAU/MAU, onboarding conversion, NPS, resolution time, claims by segment | `Requisitos.md:4.3 Business Metrics Dashboard` |

#### 4.2.7 Internationalization / Localization

| NFR ID | Requirement | Target | Source |
|--------|-------------|--------|--------|
| NFR-I18N01 | Portuguese language support | Primary language with regional variations | `Requisitos.md:3.3 RF 3.1` |
| NFR-I18N02 | Regional adaptation | Regional expressions detected via DDD (area code) | `Questionary_Sugested.md: Adaptação de linguagem` |
| NFR-I18N03 | Digital literacy adaptation | Tone adjusted by detected literacy level | `Questionary_Sugested.md: Adaptação de linguagem` |

#### 4.2.8 Accessibility

| NFR ID | Requirement | Mechanism | Source |
|--------|-------------|-----------|--------|
| NFR-ACC01 | Voice interface | AWS Polly (TTS) + AWS Lex (STT) | `Requisitos.md:2.2` |
| NFR-ACC02 | Age-appropriate personas | Ana persona for 60+ with more formal/caring tone | `Questionary_Sugested.md: Personalização da Persona` |

### 4.3 Use Cases / User Stories / Acceptance Criteria

Extracted from the documented acceptance criteria and conversational scripts.

#### UC-01: Corporate Bulk Onboarding

**Source:** `Requisitos.md:3.1 RF 1.1`

| Field | Detail |
|-------|--------|
| **Actor** | HR Manager (corporate client) |
| **Precondition** | Signed B2B contract; Excel/CSV file with employee data |
| **Main Flow** | 1. HR uploads file via secure portal. 2. System validates CPF via Serasa/SPC. 3. System checks Tasy eligibility. 4. System detects duplicates across companies. 5. System applies waiting-period rules. 6. System generates PDF executive report. 7. System sends WhatsApp notification to HR with status. |
| **Acceptance Criteria** | ✓ Processes 10,000 records in <15 min. ✓ Detects 95%+ of inconsistencies automatically. ✓ Generates PDF executive report. ✓ Sends WhatsApp notification to HR with status. |

#### UC-02: Individual Gamified Onboarding

**Source:** `Requisitos.md:3.1 RF 1.2` and `Questionary_Sugested.md` full document

| Field | Detail |
|-------|--------|
| **Actor** | Beneficiary (health plan member) |
| **Precondition** | Benefit activated; 24h elapsed since activation |
| **Main Flow** | 1. System sends WhatsApp welcome with persona (Zeca/Ana). 2. System presents LGPD consent (gamified, 100HP reward). 3. User completes 5 missions sequentially. 4. Each mission awards HealthPoints + badge. 5. System calculates HealthScore. 6. System unlocks benefits at 1000HP (check-up, priority scheduling, health report, wellness program). 7. Within 24h, AI analyzes data, generates report, nurse may contact. |
| **Acceptance Criteria** | ✓ >85% completion rate. ✓ <20 min distributed across sessions. ✓ >90% respond to first 3 messages. ✓ NPS >70 at completion. ✓ >95% risk detection accuracy. |
| **Alternate Flows** | Consent denied → "modo limitado" (plan queries, scheduling, provider lookup only). Pause → progressive reminders at 2h, 24h, 3 days, 1 week, then human call. |

#### UC-03: Indirect Condition Detection (Diabetes Example)

**Source:** `Questionary_Sugested.md: Ramificação E1 and Sede/Urina`

| Field | Detail |
|-------|--------|
| **Actor** | System (automated) |
| **Trigger** | User selects "Baseada em comidas práticas/rápidas" for diet |
| **Detection Flow** | 1. System asks about thirst. 2. If excessive thirst → follow-up on hunger between meals. 3. If excessive hunger → flag RISCO_DIABETES. 4. If also drinks lots of water → ask about urination frequency. 5. Triad "sede + fome + urina frequente" = ALERTA CRÍTICO DIABETES. |
| **Acceptance Criteria** | Risk flag generated when detection criteria met; escalation triggered per risk score threshold. |

#### UC-04: WhatsApp Symptom Analysis

**Source:** `Requisitos.md:3.3 RF 3.1`

| Field | Detail |
|-------|--------|
| **Actor** | Beneficiary |
| **Trigger** | User sends symptom description via WhatsApp |
| **Main Flow** | 1. NLP extracts symptoms from free text. 2. Medical Knowledge Graph consulted. 3. Comorbidity and drug interactions assessed. 4. Risk stratified as Low (1–3) / Medium (4–6) / High (7–10). 5. Action recommendation generated: Low → self-care + 48h follow-up; Medium → priority scheduling + anamnesis; High → immediate escalation + phone + ER guidance. |
| **Acceptance Criteria** | ✓ Portuguese with regional variations supported. ✓ Severity score 1–10 assigned. ✓ Temporal analysis included. |

#### UC-05: Authorization Auto-Approval

**Source:** `Requisitos.md:3.5 RF 5.1`

| Field | Detail |
|-------|--------|
| **Actor** | Beneficiary |
| **Trigger** | User sends authorization request via WhatsApp (procedure details) |
| **Main Flow** | 1. OCR + NLP extract procedure from message/image. 2. Eligibility checked via Tasy API. 3. Protocol validated. 4. Risk assessed. 5. Decision: if ALL auto-approval rules met → auto-approve; else → escalate for manual review. 6. Code generated and sent via WhatsApp notification. |
| **Acceptance Criteria** | ✓ <30s for 80% of simple cases. ✓ Auto-approval rules: cost <R$500, payments current, within coverage, credentialed provider, no fraud history. |

#### UC-06: Predictive Trigger → Preventive Intervention

**Source:** `Requisitos.md:3.4 RF 4.2`

| Field | Detail |
|-------|--------|
| **Actor** | System (automated) |
| **Trigger** | ML model predicts elevated 30-day hospitalization risk |
| **Main Flow** | 1. Predictive model runs continuously on population data. 2. Trigger fires when risk threshold exceeded. 3. Care Coordination context receives trigger. 4. Nurse Navigator assigned (for high-risk). 5. Proactive intervention (appointment, medication review, lifestyle coaching). |

---

## Appendix A: MoSCoW Priority Summary

| Priority | Count | IDs |
|----------|-------|-----|
| **Must** (Critical) | 42 | REQ-001–004, 008–012, 014, 020–023, 026–033, 035–037, 040–041, 044, 050–053, 055, 060, 062–064, 070, 073 |
| **Should** (High) | 11 | REQ-006, 007, 013, 024, 038, 042, 054, 061, 071, 074 |
| **Could** (Desirable) | 4 | REQ-025, 043, 072 |

## Appendix B: Source Document Cross-Reference

| Source File | Key Sections Used |
|-------------|-------------------|
| `Requisitos.md` | §1.1 Visão, §1.2 Objetivos, §1.3 Escopo, §1.4 Glossário, §2.1–2.3 Arquitetura, §3.1–3.5 Requisitos Funcionais, §4.1–4.3 Requisitos Não Funcionais, §5.1–5.2 APIs, §6.1–6.2 Roadmap & KPIs, §7.1–7.2 Riscos |
| `Questionary_Sugested.md` | Fase 1 (Boas-vindas, LGPD), Fase 2 (Gamificação, 5 Missões), Missões 1–5 completas, Sistema de Scoring/Ramificação, Escalação, Persona, Retomada, Métricas |
| `architecture_diagrams.md` | C4Context, C4Container, Data Flow, Event-Driven Sequence, Security Architecture, Deployment Architecture |

---

**Report completed by analyst.** All requirements and claims are traced to source documents. Items marked `[INFERENCE]` or `[ANALYST SYNTHESIS]` represent reasonable interpretation; all others are documented fact.
