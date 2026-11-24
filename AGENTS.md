# Instruções do Projeto Evolução

## Fonte de verdade e ordem de leitura

1. Leia integralmente a especificação pessoal local `PROMPT_APP_EMAGRECIMENTO_OTAVIO.md` antes de implementar requisitos. Ela está ignorada pelo Git por conter dados pessoais. Se ausente, solicite acesso ao documento; não invente requisitos.
2. Leia [plano](docs/IMPLEMENTATION_PLAN.md), [backlog](docs/BACKLOG.md), [arquitetura](docs/ARCHITECTURE.md), [dados](docs/DATA_MODEL.md) e [estado da entrega](docs/DELIVERY.md).
3. Implemente **uma fase por vez**, conforme a solicitação atual. Não avance silenciosamente para outra fase. Atualize o backlog, a evidência e o próximo incremento ao terminar.

## Regras obrigatórias

- Android prioritário; React Native + Expo Router + TypeScript estrito; SQLite real offline. Sem backend, login remoto ou serviços pagos para o núcleo.
- Fluxo: tela → hook/caso de uso → repositório → SQLite. SQL parametrizado; domínio independente de React.
- Nenhum mock, registro fictício, botão decorativo ou simulação em produção. Recursos futuros devem ter escopo explicitado, sem parecer funcionais.
- Perfil de referência não é pesagem. Onboarding não cria consumo, sessões ou medidas.
- SQLite é a fonte persistente; estado React contém apenas cópia de leitura e estado visual. Inicialização e migrações precedem navegação.
- Migrações incrementais, transacionais e imutáveis depois de utilizadas. FK em toda conexão. Acesso à conexão serializado para impedir consultas alheias dentro de transações.
- Quantidades finitas; desconhecido = `null`, distinto de zero. Dia civil calculado no fuso do perfil; eventos UTC; preservar data/fuso históricos.
- IDs UUID no dispositivo, submit lock e gravações agregadas em transação. Visibilidade nunca exclui registros.
- Metas e planos versionados; snapshots para históricos alimentares e de treino. Não alterar passado a partir do catálogo.
- Sem telemetria, logs pessoais, permissões desnecessárias, dados pessoais versionados ou backups no Git. Preset privado em `.private/`, módulo gerado em `src/generated/`.
- Nunca fazer commit, push, publicação, migração destrutiva ou excluir dados existentes sem autorização explícita.
- Não delegar trabalho a agentes adicionais automaticamente; `AGENTS.md` é orientação de manutenção, não autorização de delegação.

## Verificação e entrega

- Preferência atual: desenvolver e validar somente em **celular físico**, usando Expo Go pelo QR code. Não iniciar emulador, AVD, Android Studio ou simulação automaticamente, inclusive para testes.
- `npm start` / `npm run android` abrem somente o Metro para Expo Go; `npm run start:tunnel` é alternativa quando a rede local não funcionar. Manter um único servidor do projeto e o limite de um worker do Metro.
- SDK/JDK e compilação nativa ficam restritos a pedidos de APK/build instalado; selecionar explicitamente o celular conectado. Roteiros antigos de emulador são históricos e não devem ser executados. Se não houver celular acessível, registrar aceite pendente sem abrir emulador.

### Aprendizados de execução

Use `npm.cmd start` como padrão quando celular e computador estiverem na mesma rede; use `npm.cmd run start:tunnel` para redes diferentes, isolamento de Wi-Fi ou falha de acesso local após conferir a conexão. O túnel exige internet nos dois dispositivos, pode ser mais lento e gera um endereço externo de desenvolvimento; mantenha link/QR privados e o SQLite no celular como fonte persistente. Ao trocar de modo, encerre o Metro anterior com `Ctrl+C` e escaneie o QR atual, preservando um único servidor e um worker; uma conexão por túnel já funcional não precisa ser trocada sem motivo. Preserve o cache e use instalação de dependências/limpeza de cache somente quando necessário; o passo a passo e a solução de falhas ficam no [README](README.md#desenvolvimento), e os aceites físicos em [TESTING.md](docs/TESTING.md).

### Checagens de entrega

- Use `npm` e preserve `package-lock.json`. No PowerShell com scripts bloqueados, use `npm.cmd`/`npx.cmd`.
- Consulte documentação oficial e use `npx expo install` para compatibilidade nativa. Instale dependências conforme necessidade da fase.
- Execute `npm run check`, `npm run build` e `npx expo install --check` ao fechar cada fase; acrescente testes pertinentes ao fluxo.
- Testes de banco usam SQLite real em arquivo via `node:sqlite`; mocks nativos ficam restritos a testes de componentes. Não confundir esses testes com validação no aparelho.
- Documente comandos, resultados, limitações reais e aceite Android pendente. Não declare fase aceita se algum critério obrigatório ainda não foi verificado.
- UI em pt-BR, tokens, temas escuro/claro/sistema, alvos ≥48 dp, áreas seguras, teclado e rótulos acessíveis. Sem culpa ou prescrição médica automática.
- Mantenha documentação em pt-BR e links relativos entre documentos. Não replique dados pessoais da especificação nos documentos versionáveis.
