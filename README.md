# Evolução

Aplicativo pessoal Android com React Native, Expo Router, TypeScript estrito e SQLite local. Interface em pt-BR. **Entrega atual: Fase 0 — fundação.** Perfil, preferências, referências iniciais e navegação são funcionais. Alimentação, água, treinos e evolução corporal serão implementados nas fases seguintes; ainda não utilizar esta versão como diário de saúde.

## Desenvolvimento

Pré-requisitos: Node 22.18+ compatível com Expo 58 (validado em Node 24.15), npm e, para Android, aparelho com Expo Go compatível ou Android Studio/SDK e emulador. No PowerShell com política de execução bloqueada, use `npm.cmd` e `npx.cmd` nos comandos abaixo.

```powershell
npm.cmd ci
npm.cmd start
# Abrir no emulador/aparelho Android:
npm.cmd run android
```

Quando o SDK não estiver no PATH:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
npm.cmd run android
```

Escolha o JDK exigido pelo Gradle da versão Expo instalada; o comando de APK precisa do ambiente nativo completo. O Expo Go carrega JavaScript pelo Metro durante desenvolvimento, portanto utiliza rede. Os dados são persistidos em SQLite real no sandbox do projeto, sem servidor de aplicação. iOS exige ambiente apropriado; não foi validado nesta entrega.

## Comandos

| Comando                    | Resultado                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run prepare`          | Gera preset privado local ou defaults neutros, sem persistir perfil.                                      |
| `npm run typecheck`        | TypeScript estrito, sem emitir JS.                                                                        |
| `npm run lint`             | ESLint sem warnings permitidos.                                                                           |
| `npm test`                 | Jest: domínio e fluxo de formulário com React Native Testing Library.                                     |
| `npm run test:db`          | Integração com SQLite real (`node:sqlite`), incluindo arquivo/reabertura e rollback.                      |
| `npm run format:check`     | Verifica formatação.                                                                                      |
| `npm run check`            | Executa todas as verificações acima.                                                                      |
| `npm run build`            | Exporta bundle Android para `dist/`; **não gera APK**.                                                    |
| `npx expo install --check` | Compatibilidade das dependências com Expo.                                                                |
| `npx expo-doctor`          | Diagnóstico do projeto e peers.                                                                           |
| `npm run web`              | Preview web secundário com SQLite WASM e headers de isolamento configurados. Não substitui teste Android. |
| `npm run android:build`    | Compila/instala variante release nativa com SDK/JDK configurados; não publica.                            |

## Perfil privado e revisão inicial

A especificação pessoal local é a fonte de verdade e está ignorada pelo Git porque contém dados pessoais. Não adicionar esse documento, backups, bancos ou screenshots pessoais a commits.

O preset local fica em `.private/onboarding.json` e segue o schema `SetupInput` em [profile.ts](src/domain/profile/profile.ts): `profile`, `preferences` e `goals`. `npm run prepare` gera [o módulo privado](src/generated/private-onboarding.ts), também ignorado. Sem arquivo privado, o projeto compila e inicia com perfil neutro e medidas opcionais vazias. Preset inválido é descartado em favor do neutro. Os valores personalizados são incluídos apenas no bundle local: não distribuir um bundle com preset pessoal a terceiros.

O setup apresenta três etapas de revisão. Nenhum evento de consumo, treino ou peso é criado. O nome é obrigatório; os demais dados corporais são opcionais. Calorias/macros começam ocultos por escolha conservadora e podem ser ativados. Valores atípicos pedem revisão, sem bloqueio por faixa corporal arbitrária. Horários não geram notificações.

Para testes em emulador isolado, use um preset sintético e `EVOLUCAO_PRESET_PATH`. Veja [roteiro Android](docs/TESTING.md). Não executar confirmação automática no perfil pessoal real.

## Organização e continuidade

- [AGENTS.md](AGENTS.md): regras para manutenção e trabalho por fase.
- [Plano](docs/IMPLEMENTATION_PLAN.md) e [backlog](docs/BACKLOG.md): fases, dependências e critérios de aceite.
- [Arquitetura](docs/ARCHITECTURE.md) e [modelo de dados](docs/DATA_MODEL.md): decisões e integridade.
- [Testes](docs/TESTING.md) e [relatório da entrega](docs/DELIVERY.md): evidências, limitações e próximo incremento.
- [Rotas](app/), [domínio](src/domain/), [banco](src/core/database/), [features](src/features/) e [componentes/tema](src/shared/).

## Migrações e armazenamento

O banco `evolucao.db` fica no armazenamento privado do app. A inicialização habilita FK e WAL, verifica versões e migra em transação antes de montar as telas. Migrações vivem em [migrations/](src/core/database/migrations/); a versão aplicada fica em `schema_migrations`. Nunca editar uma migração já entregue nem limpar banco para corrigir upgrade. Adicionar próxima versão e testar migração/rollback. Repositórios acessam uma fila única para preservar isolamento das transações na conexão com FK.

SQLite padrão não oferece criptografia própria. Sem sincronização, reinstalação/perda do aparelho pode causar perda de dados. Backup automático Android está desabilitado na configuração nativa; Expo Go e SO têm limitações próprias. **Exportação e restauração ainda não estão implementadas:** entram na Fase 1, antes do uso como diário, e serão ampliadas nas fases seguintes. Cópias externas não podem ser apagadas pelo app.

## Android instalado

Expo Go é um cliente de desenvolvimento e não é o aplicativo distribuível. Um development build contém módulos nativos próprios, mas normalmente carrega JS do Metro; um APK release inclui bundle e assets para iniciar sem Metro. O projeto não requer conta paga ou servidor para o núcleo.

Com ambiente nativo completo, `npm run android:build` executa a compilação release local; o APK fica na árvore Android gerada, em `android/app/build/outputs/apk/release/`. Não há publicação automática. A assinatura de desenvolvimento gerada pelo Expo não deve ser usada como política de distribuição definitiva. Configuração de assinatura privada e APK final serão fechados na Fase 4. [DELIVERY.md](docs/DELIVERY.md) informa precisamente o que foi executado.
