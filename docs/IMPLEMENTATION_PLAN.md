# Plano de implementação

## Acordo de execução

Uma fase por sessão/incremento de aceite, conforme pedido do usuário. Especificação oficial local preservada e ignorada pelo Git por conter dados pessoais. O [backlog](BACKLOG.md) associa entregas a requisitos e critérios. A [entrega](DELIVERY.md) registra evidência e pendências; planejamento não equivale a implementação.

| Fase                        | Resultado                                                                                                | Dependência     | Gate de saída                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Fundação                | Projeto, rotas, design system, SQLite migrável, revisão de perfil, preferências, documentação e testes   | Nenhuma         | Checks e bundle Android; onboarding/reabertura em Android e roteiro acessível                                                  |
| 1 — Diário e dashboard      | Catálogo offline, refeições/receitas/modelos/snapshots, água e seleção de dia; backup básico             | Fundação aceita | 150 g → 195 kcal; desconhecidos parciais; cópia independente; água 1.050 mL/desfazer; exportação/restauração válida e inválida |
| 2 — Treinos                 | Biblioteca, fichas de readaptação e AB, agenda versionada, sessão recuperável, timer, histórico e cardio | Fase 1 aceita   | Encerrar processo e retomar séries; 720 kg·reps; ficha não altera passado; cancelamento e cardio sem contagem dupla            |
| 3 — Evolução                | Peso, medidas, gráficos, calendário, edição de metas, sono, hábitos, revisão e resumo selecionável       | Fase 2 aceita   | −4,5 kg/5%; uma pesagem/dia; médias com cobertura; sono 8 h; histórico de metas preservado; privacidade respeitada             |
| 4 — Robustez e distribuição | Backup completo/CSV, exclusão total, lembretes opt-in, acessibilidade e APK                              | Fase 3 aceita   | Round-trip de todos os módulos; rollback inválido; CSV seguro; permissões recusadas; regressão offline e teste no Android      |

## Ambiente de execução e validação

O [guia de desenvolvimento](../README.md#desenvolvimento) define como instalar, iniciar no celular e escolher entre Wi-Fi local e túnel. Preferir a rede local quando ela funcionar; usar o túnel para redes diferentes ou acesso local bloqueado, com internet nos dois dispositivos. Trocar de modo exige encerrar o servidor anterior e usar o QR atual, mantendo um Metro e um worker.

A manutenção DEV-01/DEV-02 está documentada no [backlog](BACKLOG.md); DEV-03 e os aceites físicos continuam pendentes. Futuras validações seguem o [roteiro em celular](TESTING.md). Esta atualização de documentação não inicia outra fase.

## Sequência da Fase 0

1. Inspecionar repo/ambiente e ler especificação completa.
2. Fixar base Expo compatível e lockfile, scripts e checagens.
3. Criar migração transacional e repositório tipado; testar em SQLite real.
4. Entregar revisão de perfil e referências iniciais, sem criar histórico; persistir preferências e permitir edição.
5. Navegação com cinco destinos e escopo explicitado para fases futuras; temas e privacidade reais.
6. Rodar typecheck, lint, unidade/componentes, integração SQLite, compatibilidade Expo e bundle Android.
7. Verificar celular físico disponível e registrar limites da execução. Se indisponível, manter aceite pendente sem iniciar emulador. Atualizar docs antes de encerrar a fase.

## Incremento atual — Fase 1

A solicitação de continuidade iniciou a Fase 1. A revisão manual F0-09 continua explicitamente pendente e não foi convertida em aceite. Não foi iniciada a Fase 2.

1. Migração 002 aditiva e schemas de catálogo, snapshots, cobertura e datas/fusos.
2. Repositórios sobre a fila compartilhada; CRUD agregado e UUID estável nas tentativas.
3. Catálogo offline, diário descritivo/nutricional, cópia e modelos, receitas com rendimento final.
4. Água rápida/customizada, edição e desfazer por ID; dashboard com seleção de dia compartilhada.
5. Backup básico de todos os módulos entregues, prévia e substituição confirmada transacional.
6. Testes de domínio/componentes e SQLite em arquivo; checks, bundle e compatibilidade nativa. Evidência Android e pendências de aceite em [DELIVERY.md](DELIVERY.md).

## Política de continuidade

Cada incremento vertical inclui UI, validação, domínio, banco e teste. Dependências só entram quando utilizadas. Não reescrever módulos aceitos sem necessidade. Critérios falhos são corrigidos antes do próximo incremento; gates que dependam de ambiente continuam explicitamente pendentes. Não publicar ou fazer commit sem autorização.
