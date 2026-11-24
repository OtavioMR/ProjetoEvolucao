# Estado da entrega

Fase atual: **1 — Diário e dashboard implementados; aceite Android completo pendente**. A solicitação de continuidade iniciou esta fase, preservando a pendência manual F0-09. O produto completo ainda não está entregue. A Fase 2 não foi iniciada.

## Fluxo atual de desenvolvimento no celular

Por solicitação do usuário, usar somente celular físico para desenvolvimento e novas validações Android. `npm start` e `npm run android` iniciam apenas o Metro para Expo Go/QR code; não lançam emulador. `npm run start:tunnel` fica como alternativa à rede Wi-Fi local. O Metro usa um worker para reduzir CPU/memória, com possível aumento no tempo da primeira compilação. SDK/JDK e build nativo ficam fora da rotina diária; o comando de build exige seleção explícita do celular e não inicia outro Metro.

A preferência está registrada em [AGENTS.md](../AGENTS.md), [README.md](../README.md) e [TESTING.md](TESTING.md). Na inspeção deste ajuste, não havia emulador em execução nem dispositivo conectado por ADB. As evidências de emulador abaixo foram obtidas anteriormente e são mantidas como histórico; não representam validação desta configuração em celular físico.

Verificação deste ajuste: opções conferidas no CLI instalado e na documentação oficial do [Expo](https://docs.expo.dev/more/expo-cli/) e do [Metro](https://metrobundler.dev/docs/configuration/#maxworkers); leitura da configuração confirmou `maxWorkers: 1`. `npm run lint` e `npm run format:check` passaram. Havia somente um servidor do projeto em execução, por túnel; é necessário reiniciá-lo para aplicar a nova configuração. Não foram instaladas dependências, executados builds nativos ou iniciados emuladores neste ajuste.

## Atualização do guia de execução

O [README](../README.md#desenvolvimento) passou a concentrar primeira instalação, rotina diária pelo celular, tabela de decisão entre Wi-Fi local e túnel, troca de modo com `Ctrl+C` e novo QR, solução de conexão e preservação do cache. [AGENTS.md](../AGENTS.md), [TESTING.md](TESTING.md), [arquitetura](ARCHITECTURE.md) e [plano](IMPLEMENTATION_PLAN.md) remetem ao mesmo fluxo. A manutenção ficou nos itens DEV-01/DEV-02 do [backlog](BACKLOG.md), com DEV-03 pendente de confirmação em celular físico. A fase atual e os aceites anteriores foram preservados.

Este complemento altera documentação e instruções; não executa o aplicativo, inicia Metro/túnel/emulador ou instala dependências. A orientação de conexão foi conferida com a [referência oficial do Expo CLI](https://docs.expo.dev/more/expo-cli/#tunneling) e com os scripts existentes. A validação documental verifica formatação, links relativos e consistência dos comandos.

Resultado da revisão documental: `npm run format:check` passou; 56 links relativos/âncoras foram conferidos nos sete documentos revisados. Os comandos documentados foram comparados com os scripts do projeto e com `maxWorkers: 1`. Nenhuma execução em celular foi realizada nesta revisão.

## Incremento da Fase 1

- Migração 002 aditiva: alimentos/porções, receitas/ingredientes, modelos/itens, refeições/itens e água. A migração 001 foi preservada. Mesma conexão/fila para perfil, diário e backup; FK e transações em todos os agregados.
- Catálogo local editável, preparo/marca/fonte/versão, equivalências explícitas, favoritos/recentes e arquivamento. Os nomes iniciais opcionais não contêm nutrientes inventados. Catálogo e sugestões de modelos entram apenas por ação do usuário, em lote transacional; modelos nunca criam consumo automaticamente.
- Diário por data: adicionar/editar/excluir refeição e itens, duplicar itens, repetir/copiar refeição para data revisada e salvar/editar modelos. Registro descritivo sem pesar; fome, saciedade, contexto e observações opcionais. Excluir refeição, modelo ou bebida exige confirmação na UI; desfazer água é uma ação explícita imediata.
- Snapshots nutricionais preservam passado após editar catálogo, receita ou modelo. Alterar quantidade recalcula automaticamente pelo snapshot original. Conversão depende de equivalência explícita; desconhecido é `null`, zero declarado continua zero. Totais parciais indicam incompletude por nutriente.
- Receitas básicas com ingredientes em snapshots e rendimento final informado em g ou porções. O peso cru não determina o rendimento. Ingredientes podem ser descritivos; receitas aninhadas não fazem parte deste incremento.
- Água rápida pelas preferências, volume personalizado, edição retroativa, histórico por dia e desfazer o último copo por ID. Outras bebidas são registráveis e não entram no total de água pura.
- Dashboard e diário compartilham seleção de dia; atalhos abrem os registros da data. Ausência de dados aparece como não registrado/informado. Calorias/macros ocultos não aparecem nas telas de acompanhamento.
- Backup JSON formato 1/schema 2 de todos os módulos entregues. Prévia com contagens; validação de tabelas/colunas, IDs, relações, datas, metas e limites de 10 MiB/20.000 registros. Exportação explícita; oferta de exportar dados atuais e confirmação digitada antes de substituição transacional. Sem fotos, mesclagem ou envio automático.

## Verificações do incremento

`npm run check` passou com TypeScript estrito, lint sem avisos, 27 testes Jest, 20 testes SQLite e formatação. O dashboard também teve seu lançamento rápido/desfazer verificado após recarga dos dados. O layout claro foi inspecionado com fixture sintética; a escolha de data foi compactada para dar mais espaço aos registros.

| Comando/fluxo              | Evidência                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | 27 testes de domínio/data/componentes: cálculo/conversão, rendimento e cobertura, registro descritivo por data, erro de gravação, validação/limites de backup e confirmação antes da substituição.                                                                    |
| `npm run test:db`          | 20 testes em SQLite real **em arquivo**, com as migrações/repositórios de produção: fundação, upgrade 1→2 e falha DDL, snapshots/cópias, UUID idempotente, agregado/lote com rollback, água/desfazer/edição, fuso histórico, round-trip e falha durante substituição. |
| `npm run build`            | Exportação Android com assets locais passou; bundle Hermes de aproximadamente 3,8 MB. Não é APK.                                                                                                                                                                      |
| `npx expo install --check` | Dependências compatíveis com SDK 58.                                                                                                                                                                                                                                  |
| `npx expo-doctor`          | 20/20 verificações passaram.                                                                                                                                                                                                                                          |
| Android / Expo Go          | Refeição descritiva retroativa em 07/04 às 23h50 registrada pela UI; água rápida 250 + 500 mL, desfazer o segundo copo e volume personalizado de 300 mL, total final 550 mL.                                                                                          |
| Encerrar/reabrir processo  | Refeição e água sintéticas recuperadas após `force-stop`; nenhum onboarding repetido.                                                                                                                                                                                 |
| Exportação nativa          | JSON criado com FileSystem e folha de compartilhamento do Android aberta. Nenhum destinatário selecionado nem arquivo enviado automaticamente.                                                                                                                        |

Os roteiros [android-diary-smoke.mjs](../scripts/android-diary-smoke.mjs) e [TESTING.md](TESTING.md) reproduzem a execução com perfil sintético. O Expo Go precisou de encaminhamento ADB/loopback para acessar o Metro; a primeira tentativa pelo endereço do host falhou ao baixar o bundle, antes de executar o app. O roteiro foi ajustado para distinguir aba/botão Hoje e preencher o campo editável pelo rótulo acessível. Nenhum dado pessoal foi confirmado ou usado nos testes. Testes no host não representam aceite em aparelho.

## Aceite ainda pendente

Também foi verificado registro/desfazer de água com modo avião ativo no emulador e o bundle já carregado. O estado anterior do modo avião foi restaurado. Isso comprova a operação local nessa sessão, sem comprovar cold start de APK independente do Metro. O seletor compacto de data também abriu e consultou a data retroativa pelo rótulo acessível.

- F0-09: TalkBack, fonte ampliada e tela pequena em todos os fluxos principais.
- F1-10: completar roteiro Android de catálogo/rótulo (195 kcal), edição/snapshots/cópia, receitas/modelos, visibilidade, seleção de arquivo e restauração confirmada. O motor de restauração, round-trip, rollback e confirmação da interface já têm testes automatizados, com evidências distintas.
- Cold start em modo avião e independente do Metro continua exigindo APK na Fase 4. Não declarar o app distribuível nem o núcleo completo entregue nesta fase.

## Entregue na fundação

- Expo Router com cinco abas e rotas protegidas: sem perfil, apenas onboarding; após confirmação, perfil/preferências/referências/privacidade. Destinos futuros são informativos e identificam sua fase.
- Onboarding em três etapas com valores locais revisáveis, opcionais, decimais pt-BR, validação de fuso/horários, confirmação de medidas atípicas, bloqueio de submit repetido e recuperação de erro.
- SQLite real, fila de acesso, FK, WAL, migração transacional/idempotente, constraints e triggers de não sobreposição de metas. Perfil + preferências + metas são gravados atomicamente.
- Edição de perfil e preferências: indicadores, escuro/claro/sistema, água rápida, semana, dias, nomes/horários de refeições e rotina de treino/sono. Ocultar indicadores preserva metas.
- Tokens e componentes acessíveis, safe area, tratamento de teclado e fonte do sistema. Privacidade contextual e ausência de permissões solicitadas no onboarding.
- Preset pessoal e especificação ignorados pelo Git. Defaults neutros para instalação sem preset. Nenhuma refeição, treino ou pesagem é criada no onboarding.
- Documentação, plano, backlog e instruções para próximos agentes em pt-BR. Sem commit, push ou publicação.

## Ambiente inspecionado

Windows/PowerShell, Node 24.15.0 e npm 11.12.1. Scripts PowerShell bloqueados: foram usados executáveis `.cmd`. Android SDK em `%LOCALAPPDATA%/Android/Sdk`, fora do PATH; AVD `Medium_Phone_API_37.0`, 1080 × 2400 px. JDK 17 e 24 encontrados. Nenhum aparelho físico conectado.

| Dependência                                | Versão instalada           |
| ------------------------------------------ | -------------------------- |
| Expo / React Native / React                | 58.0.26 / 0.88.1 / 19.3.0  |
| Expo Router / SQLite                       | 58.0.32 / 58.0.18          |
| Expo Crypto / Font                         | 58.0.8 / 58.0.12           |
| Expo FileSystem / DocumentPicker / Sharing | 58.0.14 / 58.0.5 / 58.0.23 |
| TypeScript                                 | 6.0.3                      |
| React Hook Form / resolvers / Zod          | 7.92.0 / 7.0.9 / 4.6.7     |
| Jest / jest-expo / Testing Library RN      | 30.5.2 / 58.0.15 / 14.1.0  |
| ESLint / eslint-config-expo / Prettier     | 9.39.5 / 58.0.4 / 3.10.1   |

O lockfile registra toda a árvore. APIs/combinação foram verificadas com a documentação oficial e `expo install`.

## Evidências anteriores da fundação

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
- Treino, peso, medidas, sono, relatórios, CSV, lembretes e exclusão total ainda estão no backlog. Diário, água e backup básico foram acrescentados na Fase 1, com os limites de aceite informados acima.
- `npm audit fix` sem alterações incompatíveis foi executado; permanecem **22 avisos moderados**, sem avisos altos/críticos, na árvore transitiva `glob`/`minimatch` das ferramentas Expo/Jest. As sugestões automáticas com `--force` rebaixariam Expo para 52/Jest para 29, incompatíveis com SDK 58. Não foram aplicadas. Reavaliar patches compatíveis antes da distribuição; não declarar auditoria limpa.
- O Node emite um aviso de detecção de módulo nos testes TS; os testes passam. Não é falha de SQLite nem do aplicativo. Configuração CommonJS do Metro/Jest foi preservada.
- SQLite não tem criptografia própria. Sem backup/sincronização, perda do dispositivo ou reinstalação pode perder dados. Nenhuma promessa de segurança adicional foi feita.

## Próximo incremento exato

Concluir os aceites F0-09/F1-10 do [roteiro Android](TESTING.md), sobretudo restauração por seletor do sistema e fluxos nutricionais completos. Corrigir os problemas encontrados sem alterar migrações já utilizadas. Após revisão e nova solicitação para a próxima fase, iniciar F2-01/F2-02: biblioteca/fichas e agenda versionada; depois sessão recuperável/timer e cardio. Ampliar o backup ao introduzir novos módulos. Não iniciar a Fase 2 silenciosamente.
