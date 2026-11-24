# Evolução

Aplicativo pessoal Android com React Native, Expo Router, TypeScript estrito e SQLite local. Interface em pt-BR. **Incremento atual: Fase 1 — diário e dashboard.** Perfil, preferências, catálogo, refeições, receitas básicas, modelos, água e backup JSON são funcionais. Treinos e evolução corporal permanecem nas fases seguintes. O [relatório da entrega](docs/DELIVERY.md) distingue código verificado de aceite Android pendente.

## Desenvolvimento

O desenvolvimento padrão é pelo **celular físico com Expo Go**, para reduzir o consumo do computador. Pré-requisitos: Node 22.18+ compatível com Expo 58 (validado em Node 24.15), npm e Expo Go compatível no celular. Android Studio, SDK, JDK e emulador não são necessários nesse fluxo. No PowerShell com scripts bloqueados, use `npm.cmd` e `npx.cmd`.

### Primeira instalação e rotina diária

Na primeira instalação, ou depois de mudar as dependências do lockfile:

```powershell
npm.cmd ci
```

No dia a dia, abra um terminal na raiz do projeto e execute:

```powershell
npm.cmd start
```

Deixe celular e computador na mesma rede Wi-Fi. Abra o Expo Go no Android e escaneie o QR code exibido no terminal. `npm run android` é um atalho para esse mesmo fluxo e não tenta abrir emulador. Mantenha apenas um terminal com Metro ativo; encerre com `Ctrl+C` quando terminar. Se o servidor já estava aberto antes deste ajuste, encerre-o e inicie novamente para aplicar o limite de um worker.

### Quando usar Wi-Fi local ou túnel

| Situação                                                            | Comando                                  | Como conectar                                                                |
| ------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Celular e computador na mesma rede, com comunicação local permitida | `npm.cmd start` ou `npm.cmd run android` | Escanear o QR code no Expo Go. É o caminho padrão e costuma ser mais rápido. |
| Redes diferentes, celular no 4G/5G ou Wi-Fi que isola dispositivos  | `npm.cmd run start:tunnel`               | Ambos precisam de internet; escanear o QR code gerado pelo túnel.            |
| Mesma rede, mas o QR local não conecta após conferir rede/firewall  | `npm.cmd run start:tunnel`               | Usar como alternativa ao acesso local.                                       |

Para trocar para o túnel, encerre o servidor anterior com `Ctrl+C`, aguarde o terminal voltar ao prompt e execute:

```powershell
npm.cmd run start:tunnel
```

Espere o terminal informar que a conexão está pronta e escaneie o novo QR code. Ao voltar para a rede local, encerre o túnel com `Ctrl+C` e rode `npm.cmd start` novamente. Mantenha o computador ligado e o terminal aberto enquanto desenvolve. Ao terminar, use `Ctrl+C` para liberar os recursos do servidor.

O túnel encaminha a conexão de desenvolvimento ao Metro por um serviço externo. Pode ser mais lento ou ficar indisponível; depende da internet nos dois dispositivos. O endereço é temporário e acessível pela internet: mantenha o link e o QR code privados. Os registros continuam no SQLite do celular; a escolha entre rede local e túnel muda o acesso ao JavaScript de desenvolvimento. [Documentação oficial: conexões e túnel](https://docs.expo.dev/more/expo-cli/#tunneling).

### Se não conectar

1. Confira se o terminal ainda está aberto e escaneie o QR code da execução atual. Trocar de modo ou reiniciar pode mudar o endereço.
2. No modo local, confirme a mesma rede Wi-Fi e se rede/firewall permitem a conexão ao Node/Metro. Wi-Fi de convidados, VPN e redes institucionais podem limitar esse acesso; tente o túnel nessas condições.
3. No túnel, confira a internet do computador e do celular e a mensagem de erro do Expo CLI. Uma falha no serviço externo pode exigir nova tentativa; use a rede local quando disponível. Se o CLI pedir um componente auxiliar de túnel, siga a orientação da versão instalada; esse componente não é pré-requisito para o modo local.
4. Se a porta estiver ocupada, localize o terminal que já executa este projeto e use-o ou encerre-o antes de iniciar outro. Não mantenha dois Metro do projeto em portas diferentes.

### Manter o computador leve

O Metro usa **um worker**, reduzindo paralelismo e consumo de CPU/memória; a primeira compilação pode demorar mais. O celular executa o aplicativo e o computador serve o JavaScript. Preserve o cache entre execuções; `npm.cmd start -- --clear` fica reservado a problemas de cache/bundle, pois força nova compilação. Instalação de dependências e build nativo ficam fora da rotina de simplesmente abrir o app. iOS não foi validado nesta entrega.

## Comandos

| Comando                         | Resultado                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run prepare`               | Gera preset privado local ou defaults neutros, sem persistir perfil.                                                        |
| `npm start` / `npm run android` | Inicia Metro para abrir no Expo Go pelo QR code, no celular físico.                                                         |
| `npm run start:tunnel`          | Alternativa de conexão por túnel; usar no lugar do servidor local.                                                          |
| `npm run typecheck`             | TypeScript estrito, sem emitir JS.                                                                                          |
| `npm run lint`                  | ESLint sem warnings permitidos.                                                                                             |
| `npm test`                      | Jest: domínio e fluxo de formulário com React Native Testing Library.                                                       |
| `npm run test:db`               | Integração com SQLite real (`node:sqlite`), incluindo arquivo/reabertura e rollback.                                        |
| `npm run format:check`          | Verifica formatação.                                                                                                        |
| `npm run check`                 | Executa todas as verificações acima.                                                                                        |
| `npm run build`                 | Exporta bundle Android para `dist/`; **não gera APK**.                                                                      |
| `npx expo install --check`      | Compatibilidade das dependências com Expo.                                                                                  |
| `npx expo-doctor`               | Diagnóstico do projeto e peers.                                                                                             |
| `npm run web`                   | Preview web secundário com SQLite WASM e headers de isolamento configurados. Não substitui teste Android.                   |
| `npm run android:build`         | Compilação nativa opcional com seleção explícita do celular; requer SDK/JDK e não inicia outro Metro. Não é o fluxo diário. |

## Perfil privado e revisão inicial

A especificação pessoal local é a fonte de verdade e está ignorada pelo Git porque contém dados pessoais. Não adicionar esse documento, backups, bancos ou screenshots pessoais a commits.

O preset local fica em `.private/onboarding.json` e segue o schema `SetupInput` em [profile.ts](src/domain/profile/profile.ts): `profile`, `preferences` e `goals`. `npm run prepare` gera [o módulo privado](src/generated/private-onboarding.ts), também ignorado. Sem arquivo privado, o projeto compila e inicia com perfil neutro e medidas opcionais vazias. Preset inválido é descartado em favor do neutro. Os valores personalizados são incluídos apenas no bundle local: não distribuir um bundle com preset pessoal a terceiros.

O setup apresenta três etapas de revisão. Nenhum evento de consumo, treino ou peso é criado. O nome é obrigatório; os demais dados corporais são opcionais. Calorias/macros começam ocultos por escolha conservadora e podem ser ativados. Valores atípicos pedem revisão, sem bloqueio por faixa corporal arbitrária. Horários não geram notificações.

Os testes de interface são manuais no celular físico, conforme o [roteiro Android](docs/TESTING.md). Não executar os roteiros antigos de emulador nem confirmar dados sintéticos automaticamente no perfil pessoal real.

## Organização e continuidade

- [AGENTS.md](AGENTS.md): regras para manutenção e trabalho por fase.
- [Plano](docs/IMPLEMENTATION_PLAN.md) e [backlog](docs/BACKLOG.md): fases, dependências e critérios de aceite.
- [Arquitetura](docs/ARCHITECTURE.md) e [modelo de dados](docs/DATA_MODEL.md): decisões e integridade.
- [Testes](docs/TESTING.md) e [relatório da entrega](docs/DELIVERY.md): evidências, limitações e próximo incremento.
- [Rotas](app/), [domínio](src/domain/), [banco](src/core/database/), [features](src/features/) e [componentes/tema](src/shared/).

## Migrações e armazenamento

O banco `evolucao.db` fica no armazenamento privado do app. A inicialização habilita FK e WAL, verifica versões e migra em transação antes de montar as telas. Migrações vivem em [migrations/](src/core/database/migrations/); a versão aplicada fica em `schema_migrations`. Nunca editar uma migração já entregue nem limpar banco para corrigir upgrade. Adicionar próxima versão e testar migração/rollback. Repositórios acessam uma fila única para preservar isolamento das transações na conexão com FK.

SQLite padrão não oferece criptografia própria. Sem sincronização, reinstalação/perda do aparelho pode causar perda de dados. Backup automático Android está desabilitado na configuração nativa; Expo Go e SO têm limitações próprias. Em **Mais → Backup local**, exporte uma cópia JSON dos módulos entregues. A restauração valida o arquivo, mostra contagens, oferece exportar a base atual e exige digitar `SUBSTITUIR`; substitui todos os registros em uma transação. Arquivo inválido não altera a base. Limites: 10 MiB e 20.000 registros; formato 1, schema 2. Não existia formato de backup na Fase 0. Versões incompatíveis são recusadas. O arquivo não inclui fotos e não é criptografado. Cópias externas não podem ser apagadas pelo app.

## Diário e água

Hoje, Alimentação e Água compartilham o dia selecionado. Use os botões de dia ou informe a data em `AAAA-MM-DD`; o horário usa `HH:mm`. Registros guardam instante UTC, dia civil e fuso próprio. Alterar o fuso do perfil não desloca históricos.

No catálogo, cadastre alimentos ou adicione nomes iniciais sem nutrientes. Preencha valores apenas com fonte identificável e base de referência; em branco significa desconhecido, diferente de zero declarado. Equivalências são específicas do alimento; mL não vira g automaticamente. Favoritos e recentes estão disponíveis na seleção de itens.

Registre refeições com itens de catálogo, receitas, modelos ou descrição sem pesar. Quantidades editadas recalculam os nutrientes usando o snapshot original. Para copiar a outra data, use **Repetir ou copiar**, altere a data e confirme. Receitas exigem peso final preparado ou número de porções. Modelos são editáveis e nunca registram consumo sozinhos. As sugestões usam porções genéricas que precisam ser revisadas; não são cardápio calculado.

Água rápida usa as porções das preferências e permite desfazer o último copo por ID. O formulário permite volume, data e horário personalizados. Outras bebidas ficam fora do total de água pura. Sem registros, a interface mostra ausência de informação. Ocultar calorias/macros mantém os registros e esconde os números nas telas de acompanhamento.

## Android instalado

Expo Go é um cliente de desenvolvimento e não é o aplicativo distribuível. Um development build contém módulos nativos próprios, mas normalmente carrega JS do Metro; um APK release inclui bundle e assets para iniciar sem Metro. O projeto não requer conta paga ou servidor para o núcleo.

A compilação nativa fica para quando um APK for solicitado. Com SDK/JDK configurados e celular conectado por USB, `npm run android:build` pede a seleção do dispositivo e compila a variante release sem abrir outro Metro. Selecione somente o celular físico; se ele não estiver disponível, cancele. O APK fica em `android/app/build/outputs/apk/release/`. A compilação nativa exige mais recursos e não faz parte do uso diário via Expo Go. Não há publicação automática. Assinatura e distribuição ficam para a Fase 4. [DELIVERY.md](docs/DELIVERY.md) registra o que já foi verificado.
