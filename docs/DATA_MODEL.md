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
- Fase 2: biblioteca, fichas/exercícios, planos/agenda versionados, sessões/exercícios/séries e cardio. Um índice parcial garante uma sessão ativa por perfil; cascatas apenas em filhos exclusivos. Timer absoluto persistido; cardio desvinculado é preservado.
- Fase 3: peso, medidas, sono, hábitos/logs e revisões; unicidade hábito/data e revisão/semana. Tendências escolhem última pesagem diária; sono soma união de intervalos.
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

O backup preserva IDs, timestamps, referências e snapshots integralmente. [Validação do formato](../src/domain/backup/backup.ts) confere tabelas e colunas permitidas, perfil único, unicidade, relações, ordem dos filhos, datas/fusos e vigências/unidades das metas. A versão de migração instalada continua gerenciada pelo aplicativo; o backup não executa DDL. Testes reais em arquivo cobrem upgrade 1→2, rollback, round-trip e rejeição de versões futuras.
