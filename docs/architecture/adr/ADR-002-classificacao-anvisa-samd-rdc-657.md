# ADR-002: Encaminhamento para Classificação ANVISA SaMD (RDC 657/2022)

**Status:** Proposed
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

A plataforma AUSTA realiza funções com potencial enquadramento como Software as Medical Device (SaMD):

1. **Escore de risco clínico** (`risk-assessment.service.ts`): cardiovascular, diabetes, saúde mental, respiratório
2. **Análise de sintomas com classificação de severidade** (`whatsappAIIntegration.ts`): escala 1-10 com recomendações
3. **Detecção de emergência com escalonamento automatizado** (`emergency-detection.service.ts`): alertas para contatos de emergência e serviços

Estas funções se enquadram na definição de SaMD da ANVISA conforme RDC 657/2022, Art. 2º, que define software como dispositivo médico quando "destinado pelo fabricante a ser utilizado para qualquer finalidade prevista nos incisos I a VII do art. 2° da RDC nº 657".

A classificação de risco ANVISA segue as regras do IMDRF (International Medical Device Regulators Forum):
- **Classe I**: baixo risco (ex: software que armazena dados sem análise)
- **Classe II**: médio risco (ex: software que analisa dados para apoiar decisões clínicas, permitindo verificação independente)
- **Classe III**: alto risco (ex: software que diagnostica ou toma decisões clínicas sem verificação humana)
- **Classe IV**: máximo risco (ex: software que controla dispositivos de suporte à vida)

A plataforma AUSTA **não possui registro ANVISA** atualmente.

## Decision

Engajar um especialista regulatório ANVISA para classificar formalmente a **finalidade de uso pretendida** (intended use) da plataforma.

Classificação preliminar estimada:
- **Provável:** Classe II (analisa dados para apoiar decisões clínicas, permite verificação independente por profissional de saúde)
- **Risco de:** Classe III devido ao contexto de cuidado crítico (detecção de emergência, escalonamento para UTI)

Ações imediatas:
1. Contratar consultoria regulatória especializada em ANVISA SaMD
2. Documentar `intended use statement` formal
3. Implementar avisos (disclaimers) na interface: "Esta ferramenta é um suporte à decisão clínica. Toda recomendação deve ser validada por profissional de saúde."
4. Não processar dados reais de pacientes para decisões clínicas antes do registro

## Alternatives Considered

### Auto-classificar sem especialista
Rejeitado — alto risco de classificação incorreta, possíveis sanções da ANVISA (multas de R$ 2.000 a R$ 1.500.000, interdição do produto).

### Remover funções de escore clínico para evitar classificação SaMD
Rejeitado — proposta de valor central da plataforma é cuidado proativo baseado em risco. Remover isso elimina o diferencial competitivo.

### Operar sem registro, tratando como "bem-estar" (wellness)
Rejeitado — Risco jurídico extremo. A ANVISA tem intensificado fiscalização de health apps. A diferença entre wellness e SaMD está na finalidade declarada e nas claims de marketing. Claims como "análise de sintomas com precisão médica" no README.md atual empurram a plataforma para classificação SaMD.

## Consequences

### Positivas
- Clareza regulatória e segurança jurídica para operação
- Acesso legítimo ao mercado de saúde brasileiro
- Base para certificações futuras (SBIS/CFM)
- Diferencial competitivo: "plataforma registrada na ANVISA"

### Negativas
- Processo de registro leva 6-18 meses
- Requer evidência clínica (estudos de acurácia, validação)
- Custo estimado: R$ 50.000 a R$ 200.000+ (consultoria + taxas + estudos)
- **Crítico:** Não é possível processar dados reais de pacientes para decisões clínicas antes da obtenção do registro

## Trade-offs

- **Time-to-market vs. Conformidade regulatória:** O processo ANVISA é demorado mas não-negociável para operação legal
- **Custo financeiro vs. Risco jurídico:** R$ 200k em consultoria é mínimo comparado a multas de R$ 1.5M ou proibição de comercialização
- **MVP com funcionalidades limitadas vs. Plataforma completa:** Pode ser necessário lançar MVP sem funções de escore clínico (apenas agendamento, autorização, engajamento) enquanto o registro tramita

## References

- ANVISA RDC 657/2022: https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-657-de-24-de-marco-de-2022-389360457
- IMDRF SaMD Classification Framework: https://www.imdrf.org/documents/imdrf-final-documents
- Guia ANVISA para Regularização de Software como Dispositivo Médico: https://www.gov.br/anvisa/pt-br
