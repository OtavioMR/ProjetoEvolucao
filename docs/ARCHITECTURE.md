# Arquitetura

## Contexto e decisões

Fonte de verdade: especificação pessoal local, lida integralmente. Repositório inicial sem código. A entrega está organizada em cinco fases (0–4), com revisão entre fases solicitada pelo usuário.

| Decisão                                                     | Motivo e consequência                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Native, Expo SDK 58, Expo Router e TypeScript estrito | Android primeiro, navegação nativa e possibilidade de iOS; versões resolvidas pelo Expo e registradas no lockfile.                                                                                                                                                    |
| SQLite local, sem ORM                                       | Agregados pequenos, SQL auditável, migrações explícitas e ausência de servidor. Sem login nem sincronização.                                                                                                                                                          |
| Uma conexão e fila de operações                             | Todas as leituras/escritas do repositório passam pela mesma fila. `withTransactionAsync` mantém FK na conexão e a fila impede queries externas de entrar numa transação. A documentação do SDK 58 informa que a transação exclusiva abre outra conexão sem herdar FK. |
| Migrações antes de montar o Router                          | Nenhuma tela consulta estrutura incompleta. Falha oferece nova tentativa sem apagar banco. Versão futura desconhecida impede abertura.                                                                                                                                |
| Repositórios tipados e Zod nas fronteiras                   | SQL fora da UI; validação de formulários, JSON de preferências e dados retornados. React Hook Form controla os formulários.                                                                                                                                           |
| Context React na fundação                                   | Um perfil local e preferências não justificam cache adicional. Ao crescerem consultas por dia na Fase 1, avaliar TanStack Query. Sem usar estado visual como banco.                                                                                                   |
| Tema escuro, claro e sistema                                | Tokens sem dependência visual pesada, contraste, tipografia do sistema, sem download de fontes.                                                                                                                                                                       |
| Preset privado gerado localmente                            | `.private/onboarding.json` fornece valores editáveis; `npm run prepare` gera módulo ignorado. Sem preset, instalação inicia neutra. Nenhum evento de saúde é criado pela revisão.                                                                                     |
| Dependências por fase                                       | Gráficos, compartilhamento, notificações e arquivos só entram com o fluxo funcional correspondente. Não pedir permissões antecipadas.                                                                                                                                 |

## Ambiente de desenvolvimento

O aplicativo executa no celular físico com Expo Go; um único Metro no computador usa `maxWorkers: 1` em [metro.config.js](../metro.config.js). A rede local é o padrão de `npm start`/`npm run android`. `npm run start:tunnel` usa um serviço externo para alcançar o mesmo Metro quando a rede local estiver bloqueada ou os dispositivos estiverem em redes diferentes; exige internet em ambos e pode aumentar a latência. Os registros permanecem no SQLite do celular. O [README](../README.md#desenvolvimento) concentra comandos, troca de modo e solução de conexão; emulador e SDK/JDK ficam fora do fluxo diário.

## Camadas

`app/` contém rotas finas. `src/features/` contém telas e estado de formulário. `src/domain/` contém schemas e regras sem React. `src/core/database/` contém contrato, migrações e repositórios. `src/shared/` contém componentes, tema e provider de aplicação.

Fluxo de gravação: formulário → validação Zod → provider/caso de uso → repositório → fila → transação SQLite → recarga do perfil → UI. O formulário só sai após confirmação da gravação. Submit lock protege contra toque duplicado; SQLite impõe um perfil por instalação.

Datas civis usam `Intl.DateTimeFormat` com fuso IANA. Timestamps em UTC ISO 8601. O fuso do perfil é editável, mas não mudará datas civis de eventos históricos nas fases seguintes. Metas usam intervalos fechados de datas; inserção de versões com sobreposição é recusada pelo banco.

## Incremento da Fase 1

O provider instancia repositórios de perfil, diário e backup sobre **a mesma `DatabaseQueue`**. O hook do diário lê catálogo e dia ao focar, trocar data ou invalidar a versão de leitura; descarta respostas obsoletas. Estado React contém somente a cópia de leitura, seleção do dia, formulários e feedback. Não foi necessário adicionar um segundo sistema de cache. O último lançamento para desfazer fica na tela; não é histórico persistente.

As novas rotas são finas e chamam hooks/casos de uso. Alimentos, porções, receitas, modelos, refeições/itens e água usam schemas Zod de produção. Snapshots carregam referência, preparo, fonte, totais e completude por nutriente. Editar quantidades recalcula pelo snapshot; alterar catálogo ou receita não altera refeições anteriores. Zero declarado é preservado e totais parciais são identificados. Receitas usam rendimento final explícito; não há inferência de densidade ou peso cozido.

Identidade, relacionamentos, posição e campos consultados por dia são colunas SQLite com FK/índices. Documentos JSON armazenam os atributos validados e snapshots, evitando dezenas de colunas repetidas para a mesma estrutura nutricional. Filhos são linhas próprias, com ordem única e transação do agregado. Os documentos e suas colunas de identidade/data são conferidos na importação. Catálogos são arquivados; excluir uma refeição remove somente seus filhos exclusivos. Atualizar UUID existente é idempotente. Catálogo inicial e sugestões de modelos são inseridos em lote transacional por ação explícita.

Backup faz leitura consistente na fila e transação. Formato JSON 1/schema 2 contém tabelas permitidas e metadados, sem copiar `schema_migrations`. Validação estrita limita colunas, tabelas, IDs, vínculos, datas, metas e tamanho. Prévia não escreve. Substituição confirmada valida novamente, congela a cópia validada, remove em ordem de dependência e insere com parâmetros em uma transação. Qualquer falha restaura a base anterior. Exportação usa `File`/`Paths.cache` e compartilhamento explícito; importação usa DocumentPicker com cópia para cache privado. O seletor não confirma se o usuário guardou uma cópia externa.

Fontes oficiais: [FileSystem SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/) e [Sharing SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sharing/). Dependências instaladas com `npx expo install`; tipos das APIs conferidos nas versões instaladas.

## Privacidade e arquivos exportados

SQLite fica no diretório privado do app; não possui criptografia própria. Android `allowBackup: false` limita backup automático; políticas do SO/dispositivo continuam relevantes. Sem analytics, clientes HTTP, credenciais ou registro de dados pessoais em logs. Metro e Expo Go são ferramentas de desenvolvimento e usam rede; o APK final deve funcionar sem conexão. O preset personalizado está incluído apenas no bundle local e exige revisão antes de persistir.

## Fontes oficiais consultadas

- [Criar projeto Expo](https://docs.expo.dev/get-started/create-a-project/)
- [Instalação do Router](https://docs.expo.dev/router/installation/)
- [SQLite e limites de transações](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Testes Expo, Jest 30 e SDK 58](https://docs.expo.dev/develop/unit-testing/)
- Template oficial `expo-template-blank-typescript` consultado no npm para a combinação Expo/React/React Native/TypeScript.

Versões efetivas e evidências estão em [DELIVERY.md](DELIVERY.md). Build, teste do SQLite no host e teste Android são evidências distintas.
