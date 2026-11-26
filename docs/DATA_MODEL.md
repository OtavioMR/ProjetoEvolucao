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

- Fase 1: implementada pela [migração 002](../src/core/database/migrations/002-diary.ts), detalhada abaixo.
- Fase 2: implementada pela [migração 003](../src/core/database/migrations/003-training.ts), detalhada abaixo. Um índice parcial garante uma sessão ativa por perfil; cascatas apenas em filhos exclusivos. Timer absoluto persistido; cardio desvinculado é preservado.
- Fase 3: implementada pela [migração 004](../src/core/database/migrations/004-evolution.ts), detalhada abaixo. Peso, medidas, marcos, sono, hábitos/logs e revisões; unicidade hábito/data e revisão/semana. Tendências escolhem última pesagem diária; sono soma união de intervalos.
- Fase 4: lembretes reais e eventuais metadados de exportação. Fotos ficam fora do núcleo e exigem formato específico de backup se implementadas.

Todas as fases acrescentam índices nas FK e consultas por perfil/data, validações, testes de upgrade e rollback. Restaurar backup exigirá prévia e confirmação antes de substituição transacional; não há restauração na Fase 0.

## Fase 1 — schema 2

| Tabelas                                             | Estrutura e comportamento                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foods`, `recipes`, `meal_templates`                | UUID PK, `profile_id` FK, documento JSON validado, timestamps UTC. Índices por perfil. Todos os catálogos desta versão pertencem ao perfil local; não existem linhas globais compartilhadas.                                                                |
| `food_portions`                                     | UUID PK, alimento FK e documento com rótulo, unidade/quantidade de origem e base explícita. Uma equivalência não é densidade geral. Alterá-la não afeta snapshots.                                                                                          |
| `recipe_items`, `meal_template_items`, `meal_items` | UUID PK, pai FK com cascata, posição inteira não negativa/única por pai, alimento ou receita de origem FK e snapshot JSON. Índices nas FK de origem. Ingredientes de receitas aceitam alimentos/descrições; receitas aninhadas ficam fora deste incremento. |
| `meals`                                             | UUID PK, perfil FK, `local_date` validada, UTC e fuso históricos, documento de cabeçalho, timestamps. Índice perfil/data/horário.                                                                                                                           |
| `water_entries`                                     | UUID PK, perfil FK, data/UTC/fuso, volume inteiro positivo em mL, tipo `water`/`other`, notas e timestamps. Índice perfil/data/horário. Apenas `water` entra no total de água pura.                                                                         |

Os [schemas de domínio](../src/domain/nutrition/nutrition.ts) definem os documentos: alimento guarda preparo, marca, referência e fonte; receita exige rendimento final positivo em g ou porções; modelo guarda nome; refeição guarda título, tipo, fome/saciedade opcionais, contexto e notas. Cabeçalhos não duplicam os filhos. JSON tem `json_valid` no DDL; semântica e finitude são validadas na leitura/gravação/importação.

Cada snapshot de item guarda nome/preparo, quantidade/unidade ou descrição sem pesar, referência e nutrientes da referência, fonte, totais conhecidos e completude por nutriente. Valores desconhecidos são `null`. A soma da receita mantém completude parcial mesmo quando existe subtotal conhecido. Nenhuma conversão é inferida quando falta equivalência. IDs de porção em snapshots são referências históricas e podem sobreviver à edição das porções do catálogo.

O backup preserva IDs, timestamps, referências e snapshots integralmente. [Validação do formato](../src/domain/backup/backup.ts) confere tabelas e colunas permitidas, perfil único, unicidade, relações, ordem dos filhos, datas/fusos e vigências/unidades das metas. A versão de migração instalada continua gerenciada pelo aplicativo; o backup não executa DDL. Testes reais em arquivo cobrem upgrade 1→2 e 2→3, rollback, round-trip e rejeição de versões futuras.

## Fase 2 — schema 3

| Tabelas                                            | Estrutura e comportamento                                                                                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercises`, `workout_templates`                   | UUID PK, `profile_id` FK, documento JSON validado e timestamps UTC. Exercícios e fichas podem ser arquivados sem afetar snapshots históricos.                                                                                    |
| `workout_template_exercises`                       | UUID PK, `parent_id` FK com cascata, posição única por ficha, `exercise_id` FK e snapshot/metas de séries e reps.                                                                                                                |
| `training_plan_versions`, `training_day_overrides` | Agenda versionada por vigência civil com triggers de não sobreposição (`training_plan_overlap`), e exceções pontuais por `(profile_id, local_date)` para descanso (`rest`) ou troca (`swap`).                                    |
| `workout_sessions`                                 | UUID PK, `profile_id` FK, `template_id` (`ON DELETE SET NULL`), `local_date`, `started_at`, `completed_at`, `timezone_at_entry`, `status` e índice parcial `workout_sessions_one_active` garantindo uma sessão ativa por perfil. |
| `workout_session_exercises`, `workout_sets`        | Snapshots independentes da biblioteca/ficha e séries individuais persistidas incrementalmente com carga, repetições, RIR/RPE, tipo e status (`pending`/`completed`/`skipped`).                                                   |
| `cardio_entries`                                   | UUID PK, `profile_id` FK, `session_id` (`ON DELETE SET NULL`), data/UTC/fuso, duração, distância opcional e documento JSON. Desvincular ou excluir sessão preserva o cardio.                                                     |

Os [schemas de domínio](../src/domain/training/training.ts) definem cálculos puros de volume (`kg·reps`), timer absoluto por timestamp UTC (`targetEndAt`), recordes comparáveis por mesma convenção de carga e resumo diário de cardio sem duplicidade. O backup exporta `schemaVersion: 3` na Fase 2.

## Fase 3 — schema 4

| Tabelas                                 | Estrutura e comportamento                                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weight_entries`, `measurement_entries` | UUID PK, `profile_id` FK, `local_date`, `occurred_at`, `timezone_at_entry` e valores positivos em kg/cm. Séries diárias usam a última observação do dia.                                     |
| `body_milestones`                       | UUID PK, `profile_id` FK, título, peso alvo e notas opcionais.                                                                                                                               |
| `sleep_entries`                         | UUID PK, `profile_id` FK, `start_at`/`end_at` UTC (`end_at > start_at`), `wake_local_date`, `is_nap` e `quality` (1–5 opcional). Duração calculada pela união de intervalos não sobrepostos. |
| `habits`, `habit_logs`                  | Hábitos configuráveis com `archived_at` preservando histórico; `habit_logs` com `UNIQUE(habit_id, local_date)` e estados `done`/`not_done`/`not_applicable`.                                 |
| `weekly_reviews`                        | UUID PK, `profile_id` FK, `week_start_date` com `UNIQUE(profile_id, week_start_date)` e documento JSON validado com notas da revisão.                                                        |

Os [schemas de domínio](../src/domain/evolution/evolution.ts) definem médias móveis com cobertura, cálculo de IMC opcional, união de intervalos de sono, calendário mensal e formatação de resumo copiável. O backup exporta `schemaVersion: 4` (28 tabelas) e aceita importação retroativa de `schemaVersion: 2` e `3`.

## Fase 4 — schema 5

| Tabela      | Estrutura e comportamento                                                                                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reminders` | UUID PK, `profile_id` FK com cascata, `category` (`water`/`meal`/`training`/`sleep`/`weekly_review`), `enabled` (0/1, padrão 0), `local_time`, `weekdays` JSON, `quiet_start`/`quiet_end` opcionais, `platform_notification_ids` JSON e `UNIQUE(profile_id, category)`. |

O backup passa a exportar `schemaVersion: 5` (29 tabelas) e aceita importação retroativa de `schemaVersion: 2`, `3` e `4`, rejeitando versões `> 5`. A exclusão total (`eraseAllData`) remove todas as linhas das 29 tabelas em transação reversa de dependência.
