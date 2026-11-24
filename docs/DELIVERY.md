# Estado da entrega

Fase atual: **0 — Fundação implementada e verificada tecnicamente, pronta para revisão de aceite**. Há uma pendência manual de acessibilidade no [backlog](BACKLOG.md), F0-09. O produto completo ainda não está entregue. Nenhuma fase seguinte foi iniciada, conforme o pedido de trabalho por fases.

## Entregue

- Expo Router com cinco abas e rotas protegidas: sem perfil, apenas onboarding; após confirmação, perfil/preferências/referências/privacidade. Destinos futuros são informativos e identificam sua fase.
- Onboarding em três etapas com valores locais revisáveis, opcionais, decimais pt-BR, validação de fuso/horários, confirmação de medidas atípicas, bloqueio de submit repetido e recuperação de erro.
- SQLite real, fila de acesso, FK, WAL, migração transacional/idempotente, constraints e triggers de não sobreposição de metas. Perfil + preferências + metas são gravados atomicamente.
- Edição de perfil e preferências: indicadores, escuro/claro/sistema, água rápida, semana, dias, nomes/horários de refeições e rotina de treino/sono. Ocultar indicadores preserva metas.
- Tokens e componentes acessíveis, safe area, tratamento de teclado e fonte do sistema. Privacidade contextual e ausência de permissões solicitadas no onboarding.
- Preset pessoal e especificação ignorados pelo Git. Defaults neutros para instalação sem preset. Nenhuma refeição, treino ou pesagem é criada no onboarding.
- Documentação, plano, backlog e instruções para próximos agentes em pt-BR. Sem commit, push ou publicação.

## Ambiente inspecionado

Windows/PowerShell, Node 24.15.0 e npm 11.12.1. Scripts PowerShell bloqueados: foram usados executáveis `.cmd`. Android SDK em `%LOCALAPPDATA%/Android/Sdk`, fora do PATH; AVD `Medium_Phone_API_37.0`, 1080 × 2400 px. JDK 17 e 24 encontrados. Nenhum aparelho físico conectado.

| Dependência                            | Versão instalada          |
| -------------------------------------- | ------------------------- |
| Expo / React Native / React            | 58.0.26 / 0.88.1 / 19.3.0 |
| Expo Router / SQLite                   | 58.0.32 / 58.0.18         |
| Expo Crypto / Font                     | 58.0.8 / 58.0.12          |
| TypeScript                             | 6.0.3                     |
| React Hook Form / resolvers / Zod      | 7.92.0 / 7.0.9 / 4.6.7    |
| Jest / jest-expo / Testing Library RN  | 30.5.2 / 58.0.15 / 14.1.0 |
| ESLint / eslint-config-expo / Prettier | 9.39.5 / 58.0.4 / 3.10.1  |

O lockfile registra toda a árvore. APIs/combinação foram verificadas com a documentação oficial e `expo install`.

## Evidências

| Verificação                              | Resultado                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                      | Passou, TS estrito.                                                                                                                                                                       |
| `npm run lint`                           | Passou, zero erros/warnings.                                                                                                                                                              |
| `npm test`                               | 13 testes passaram: 10 casos de domínio/data e 3 de formulário completo, incluindo erro/recuperação.                                                                                      |
| `npm run test:db`                        | 9 testes passaram em SQLite real: migração 0→1/idempotência, arquivo/reabertura, agregado com rollback, submit concorrente, FK/metas, versão futura, rollback DDL, parametrização e fila. |
| `npm run format:check` e `npm run check` | Passaram.                                                                                                                                                                                 |
| `npm run build`                          | Bundle Android exportado com assets locais. Não é APK.                                                                                                                                    |
| `npx expo install --check`               | Dependências compatíveis.                                                                                                                                                                 |
| `npx expo-doctor`                        | 20/20 verificações passaram após instalar explicitamente `expo-font`.                                                                                                                     |
| Android com Expo Go                      | Onboarding sintético, cinco abas, salvamento de tema e preferências executados por ADB/UIAutomator.                                                                                       |
| Encerrar processo e reabrir              | Perfil sintético recuperado sem repetir onboarding; escolha Claro persistida e acessível como selecionada. Script de retomada terminou com exit code 0.                                   |
| Inspeção visual                          | Tela de preferências clara inspecionada com fixture sintética; corrigido espaçamento duplicado de safe area em telas com header nativo.                                                   |
| Proteção Git                             | `git check-ignore` confirmou especificação, preset pessoal e módulo gerado ignorados.                                                                                                     |

O primeiro roteiro Android revelou a rolagem mantida entre etapas do onboarding; foi corrigida e o onboarding repetido com sucesso. O cold launch do Expo Go precisou reenviar seu deep link após abrir o launcher; o roteiro foi ajustado para esse comportamento da ferramenta. Nenhum dado pessoal real foi confirmado pelo teste. A fixture persistida existe apenas no sandbox de teste do emulador.

## Pendências e limitações reais

- F0-09: revisar fonte ampliada, teclado, tela pequena e TalkBack. Alvos/rótulos existem, mas a validação por leitor de tela não foi executada.
- Não foram gerados/instalados APK release nem executados testes em aparelho físico ou iOS. A execução Android comprovada foi em Expo Go. O funcionamento independente do Metro e cold start em modo avião exigem APK e são gates da Fase 4. Não confundir ausência de backend com evidência desse teste.
- Preview web não foi validado nesta entrega. SQLite WASM/headers foram configurados como apoio; Android permanece alvo principal.
- Não há alimentação, água, treino, peso, sono, relatórios, backup/restauração ou notificações funcionais ainda. Estão no backlog. Não usar a fundação para guardar diário real antes do backup da Fase 1.
- `npm audit fix` sem alterações incompatíveis foi executado; permanecem **22 avisos moderados**, sem avisos altos/críticos, na árvore transitiva `glob`/`minimatch` das ferramentas Expo/Jest. As sugestões automáticas com `--force` rebaixariam Expo para 52/Jest para 29, incompatíveis com SDK 58. Não foram aplicadas. Reavaliar patches compatíveis antes da distribuição; não declarar auditoria limpa.
- O Node emite um aviso de detecção de módulo nos testes TS; os testes passam. Não é falha de SQLite nem do aplicativo. Configuração CommonJS do Metro/Jest foi preservada.
- SQLite não tem criptografia própria. Sem backup/sincronização, perda do dispositivo ou reinstalação pode perder dados. Nenhuma promessa de segurança adicional foi feita.

## Próximo incremento exato

Revisar a Fase 0 e F0-09 com o usuário. Na próxima fase autorizada, iniciar **F1-01/F1-03**: migração 002 de alimentos/porções, receitas e rendimento, modelos, refeições/itens com snapshots e água; domínio de conversão/cobertura e testes SQLite. Em seguida, entregar cada fluxo vertical de diário/água/dashboard e backup básico F1-09 antes do uso real. Atualizar os documentos a cada incremento e não saltar para treinos.
