# ADR-001: Adoção do Framework Regulatório LGPD/ANS/ANVISA

**Status:** Accepted
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

O codebase, schema do banco de dados e documentação referenciam frameworks regulatórios estrangeiros que não se aplicam ao mercado brasileiro. A plataforma AUSTA tem como alvo o mercado brasileiro — é uma operadora de plano de saúde brasileira. Regulamentações de outros países NÃO se aplicam a operações exclusivamente brasileiras.

O framework regulatório correto para o contexto brasileiro é:

- **LGPD** (Lei Geral de Proteção de Dados, Lei 13.709/2018) — proteção de dados pessoais e sensíveis
- **ANS** (Agência Nacional de Saúde Suplementar) — regulação de operadoras de planos de saúde
- **ANVISA** (Agência Nacional de Vigilância Sanitária) — regulação de Software as Medical Device (SaMD)

Referências a frameworks estrangeiros foram encontradas em:
- `schema.prisma`: campos de compliance com nomenclatura externa
- `DATABASE_SCHEMA_DOCUMENTATION.md`: múltiplas menções a frameworks não aplicáveis
- `package.json`: descrição do projeto
- `architecture_diagrams.md`: seção de Compliance
- `README.md`: seção de Compliance

## Decision

Substituir TODAS as referências a frameworks regulatórios estrangeiros por LGPD/ANS/ANVISA em todo o codebase, schema e documentação.

Ações específicas:
1. Remover campos com nomenclatura externa do schema Prisma
2. Adicionar campos `lgpdCompliant` e `lgpdRelevant` onde apropriado
3. Atualizar `package.json` description
4. Atualizar toda documentação para referenciar apenas LGPD/ANS/ANVISA
5. Criar migration SQL para renomear colunas no banco (`002_rename_compliance_columns.sql`)

## Alternatives Considered

### Manter ambos frameworks (estrangeiro e brasileiro)
Rejeitado — adiciona confusão, dobra a carga de compliance sem benefício. A plataforma não opera fora do Brasil.

### Remover ambos e não ter framework de compliance
Rejeitado — ilegal para dados de saúde brasileiros. LGPD Art. 6º exige finalidade específica e base legal para tratamento de dados sensíveis.

### Adotar apenas LGPD, ignorando ANS/ANVISA
Rejeitado — ANS regula operadoras de saúde (RN 277/2011, RN 305/2012) e ANVISA regula software com finalidade clínica (RDC 657/2022).

## Consequences

### Positivas
- Conformidade legal com jurisdição correta
- Eliminação de claims enganosos sobre compliance
- Postura regulatória correta para o mercado brasileiro
- Facilita certificações futuras (ISO 27701, SBIS/CFM)

### Negativas
- Migration necessária para renomear colunas no banco
- Reescrever documentação (≈15 arquivos)
- Retrainamento do time sobre LGPD/ANS/ANVISA

## Trade-offs

- **Esforço agora vs. Risco regulatório depois:** Quanto mais tempo as referências a frameworks estrangeiros permanecerem, maior o risco de liability
- **Custo da migration:** ~2-3 dias de desenvolvimento para renomear colunas e atualizar documentação
- **Risco de breaking change:** Migration de colunas requer coordinated deploy com downtime planejado

## References

- Lei 13.709/2018 (LGPD): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- ANVISA RDC 657/2022: https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-657-de-24-de-marco-de-2022-389360457
- ANS RN 277/2011: https://www.ans.gov.br/component/legislacao/?view=legislacao&task=TextoLei&format=raw&id=MTc0MQ==
