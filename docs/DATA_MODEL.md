# Modelo de dados

## Fase 0

O DDL executável está em [001-foundation.ts](../src/core/database/migrations/001-foundation.ts). Essa é a fonte dos detalhes de constraints; este documento resume a intenção. Nomes em snake_case no banco, objetos tipados em camelCase no domínio.

| Tabela              | Chaves, campos e nulabilidade                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_migrations` | `version INTEGER PK`, `applied_at TEXT NOT NULL` UTC. Controle explícito de versões, aplicado em transação.                                                                                                                                                                                       |
| `profile`           | `id TEXT PK` UUID; `singleton INTEGER UNIQUE CHECK = 1`; `display_name TEXT NOT NULL`; idade inteira não negativa ou NULL; altura/pesos de referência/objetivo positivos ou NULL; fuso obrigatório; criação/atualização UTC. Um perfil por instalação.                                            |
| `preferences`       | `profile_id TEXT PK FK → profile` com cascata; tema em enum; locale pt-BR; JSON validado para visibilidade, água rápida, refeições e disponibilidade; semana 0 ou 1; horários de treino/sono; lembretes fixos em 0 nesta fase; timestamps. Unidades fixas kg/cm/mL/kcal, revisadas no formulário. |
| `goal_versions`     | UUID PK; perfil FK com cascata; métrica e unidade em enums compatíveis; alvo positivo; início civil obrigatório; fim civil opcional ≥ início; enabled 0/1; timestamps. Índice perfil/métrica/data; triggers INSERT e UPDATE proíbem sobreposição, inclusive nos extremos.                         |

Preferências são um agregado pequeno: arrays/objetos em JSON têm validação de forma no SQLite (`json_valid`) e validação semântica Zod na gravação e leitura. Não são substitutos para tabelas de eventos. Ausência de idade/altura/peso é NULL, nunca string vazia nem zero fictício.

O onboarding grava perfil, preferências e referências de metas em **uma transação**. Não existem tabelas de consumo ou pesagem na Fase 0; o peso de referência não é convertido em evento. Repetição técnica do onboarding é rejeitada, sem duplicação. Alterar perfil/preferências não apaga referências nem metas.

FK ligada em cada inicialização; WAL em plataformas nativas, timeout de ocupação e fila para todo acesso. Migrações são aditivas, imutáveis após uso e falhas fazem rollback. Nenhum SQL interpolará entrada do usuário. DDL estático é o único uso de `execAsync`.

## Evolução prevista (não criada antecipadamente)

- Fase 1: `foods`, `food_portions`, `recipes`, `recipe_items`, `meal_templates`, `meal_template_items`, `meals`, `meal_items`, `water_entries`. Snapshots nutricionais por item e `null` para desconhecido. Eventos preservam `local_date`, UTC e fuso. Catálogo sem valores de nutrientes não verificáveis.
- Fase 2: biblioteca, fichas/exercícios, planos/agenda versionados, sessões/exercícios/séries e cardio. Um índice parcial garante uma sessão ativa por perfil; cascatas apenas em filhos exclusivos. Timer absoluto persistido; cardio desvinculado é preservado.
- Fase 3: peso, medidas, sono, hábitos/logs e revisões; unicidade hábito/data e revisão/semana. Tendências escolhem última pesagem diária; sono soma união de intervalos.
- Fase 4: lembretes reais e eventuais metadados de exportação. Fotos ficam fora do núcleo e exigem formato específico de backup se implementadas.

Todas as fases acrescentam índices nas FK e consultas por perfil/data, validações, testes de upgrade e rollback. Restaurar backup exigirá prévia e confirmação antes de substituição transacional; não há restauração na Fase 0.
