# Backlog por fase

Legenda: `[x]` implementado e verificado conforme evidência; `[ ]` pendente. Aceite em aparelho é separado do código entregue. Prioridade P0 = integridade/núcleo; P1 = fluxo obrigatório; P2 = expansão opcional.

## Fase 0 — Fundação (implementada; revisão de aceite pendente)

- [x] F0-01 · P0 · Configurar Expo/Router/TS estrito, npm lockfile, lint, formatador e scripts (§3, §11).
- [x] F0-02 · P0 · SQLite real, FK, fila, migração versionada com rollback e recusa de versão futura (§6).
- [x] F0-03 · P0 · Perfil/preset privado revisável, campos opcionais, metas iniciais transacionais; nenhum evento fictício (§2, §5.1).
- [x] F0-04 · P1 · Preferências persistidas: indicadores, tema, água rápida, refeições/horários, dias, fuso e semana (§5.1).
- [x] F0-05 · P1 · Navegação de cinco destinos, estados de erro/recuperação, safe area, teclado e design tokens (§4).
- [x] F0-06 · P0 · Testes de domínio/formulário, SQLite real, reabertura, duplicação e migração (§9).
- [x] F0-07 · P1 · README, arquitetura, modelo, plano, backlog, AGENTS e relatório atualizados (§11).
- [x] F0-08 · P0 · Executar onboarding, cinco abas, preferências e persistência após encerramento do processo em emulador Android (§9).
- [ ] F0-09 · P1 · Revisão manual de aceite: fonte ampliada, teclado/tela pequena e TalkBack. Instalação/cold start offline de APK permanecem gates de distribuição na Fase 4.

## Fase 1 — Diário e dashboard

- [ ] F1-01 · P0 · Migração catálogo, porções, receitas/rendimento, modelos, refeições/itens e água; índices e constraints.
- [ ] F1-02 · P1 · Catálogo inicial editável offline, favoritos/recentes, preparo/fonte; não inventar nutrientes.
- [ ] F1-03 · P0 · Cálculo por referência/conversão explícita; cobertura por nutriente; zero distinto de desconhecido.
- [ ] F1-04 · P1 · CRUD diário por data/refeição, modo descritivo, contexto/fome opcionais e snapshots imutáveis.
- [ ] F1-05 · P1 · Duplicar/copiar e modelos com novos IDs, porções editáveis, templates nunca consumidos automaticamente.
- [ ] F1-06 · P1 · Receitas básicas com ingredientes, rendimento final e estimativa parcial.
- [ ] F1-07 · P1 · Água em um toque/customizada, edição retroativa, histórico, desfazer por ID; refrigerante fora do total de água.
- [ ] F1-08 · P1 · Dashboard real com dia selecionável e atalhos filtrados, sem zeros fictícios nem indicadores ocultos.
- [ ] F1-09 · P0 · Backup JSON versionado dos módulos entregues, prévia/validação, restauração por substituição confirmada, transação e rollback.
- [ ] F1-10 · P0 · Testar 195 kcal, incompletude, edição/repetição independente, 1.050 mL, fuso às 23h50, offline e round-trip.

## Fase 2 — Treinos

- [ ] F2-01 · P1 · Biblioteca e exercícios personalizados/arquivamento; fichas CRUD/reordenação e seeds confirmáveis de readaptação/AB.
- [ ] F2-02 · P0 · Agenda versionada com descanso/troca por dia e confirmação de recuperação; sem progressão automática.
- [ ] F2-03 · P0 · Início livre/ficha, snapshot, uma sessão ativa, séries individuais, convenção de carga/RIR/RPE e persistência incremental.
- [ ] F2-04 · P1 · Última sessão comparável e cópia explícita; trocar/adicionar/remover exercícios e séries.
- [ ] F2-05 · P0 · Timer absoluto, retomada após background/processo; concluir com pulos, cancelar com confirmação sem contar como feito.
- [ ] F2-06 · P1 · Treino anterior manual/edição retroativa, histórico/filtros, recordes comparáveis e volume com critérios.
- [ ] F2-07 · P1 · Cardio independente/vinculado; preservação ao desvincular e relatório sem duplicidade.
- [ ] F2-08 · P0 · Testar recuperação real, snapshots, duas séries = 720 kg·reps, cancelamento, meia-noite e não duplicação.

## Fase 3 — Evolução

- [ ] F3-01 · P1 · Peso/medidas CRUD, histórico, confirmação de valores atípicos; última pesagem/dia e médias com n/cobertura.
- [ ] F3-02 · P1 · Gráficos 7/30/90/total e alternativa textual, lacunas, marcos configuráveis; IMC opcional contextualizado.
- [ ] F3-03 · P0 · Editar metas com vigência, preservar histórico e rejeitar sobreposição.
- [ ] F3-04 · P1 · Sono por instantes UTC, despertar/data local, união de intervalos/cochilos/qualidade.
- [ ] F3-05 · P1 · Hábitos configuráveis/agendados, quatro estados, arquivamento sem reset.
- [ ] F3-06 · P1 · Calendário mensal com legenda/filtros e acesso ao dia real.
- [ ] F3-07 · P1 · Revisão semanal/mensal descritiva com cobertura, notas e resumo copiável com seleção de campos.
- [ ] F3-08 · P0 · Testar −4,5 kg/5%, ausência de dados, sono 8 h/intervalos sobrepostos, metas amanhã e ocultação sem exclusão.

## Fase 4 — Robustez e distribuição

- [ ] F4-01 · P0 · Backup/restauração de todos os módulos, limites de tamanho/IDs/relações, versões antigas/futuras e rollback.
- [ ] F4-02 · P1 · CSV UTF-8 por módulo com escaping e mitigação de fórmulas; compartilhar apenas por ação explícita.
- [ ] F4-03 · P1 · Lembretes locais por categoria opt-in, permissão contextual, silêncio, limites e reagendamento/fuso.
- [ ] F4-04 · P0 · Exclusão total com confirmação forte, banco/arquivos gerenciados/notificações e retorno ao onboarding.
- [ ] F4-05 · P1 · Revisão de acessibilidade, fontes grandes/teclado, contraste, estados, desempenho, modo avião e tratamento de erros.
- [ ] F4-06 · P0 · Testar upgrade de base anterior e regressão E2E; gerar APK e validar instalação/reabertura em Android.
- [ ] F4-07 · P1 · Documentação final de execução, backup/perda do aparelho, limitações, build/assinatura e evidências.

## Expansões após núcleo aceito

- [ ] P2 · Fotos privadas e backup de arquivos específico; biometria do sistema.
- [ ] P2 · Receitas avançadas, código de barras com licença, Health Connect/Apple Health, widgets.
- [ ] P2 · Sincronização opt-in e IA opcional com consentimento explícito. Não bloquear MVP.
