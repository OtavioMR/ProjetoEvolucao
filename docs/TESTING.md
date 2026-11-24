# Verificação reproduzível

## Verificações automatizadas

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build
npx.cmd expo install --check
npx.cmd expo-doctor
```

Fixtures são sintéticas em [fixtures.ts](../src/test/fixtures.ts). Jest usa doubles apenas nas fronteiras nativas e de navegação dos testes de componentes. O teste de banco importa exatamente as migrações e o repositório de produção; adapta a interface assíncrona ao SQLite real do Node. Isso verifica SQL, transações e persistência, mas não substitui a execução de `expo-sqlite` no Android.

O teste SQLite em arquivo cria diretório temporário exclusivo, verifica o alvo antes de remover e apaga apenas seus próprios dados sintéticos. Nenhum teste apaga banco do aplicativo.

## Android: celular físico

Desenvolvimento e validação são feitos somente pelo celular físico, conforme a preferência atual. Não iniciar emulador, AVD ou Android Studio para os testes. Os roteiros antigos em [scripts/](../scripts/) registram a automação histórica de um AVD com coordenadas fixas; ficam fora do fluxo atual e não devem ser executados no celular pessoal.

```powershell
npm.cmd start
# Ou, como atalho equivalente:
npm.cmd run android
```

Use apenas um desses comandos por vez. Com computador e celular na mesma rede Wi-Fi, escaneie o QR code pelo Expo Go. Para redes diferentes ou acesso local bloqueado, encerre o Metro anterior com `Ctrl+C`, execute `npm.cmd run start:tunnel` e escaneie o QR atual; o túnel exige internet nos dois dispositivos. O Metro fica limitado a um worker. Esse fluxo dispensa SDK/JDK, cabo USB e depuração Android. O [guia de conexão](../README.md#quando-usar-wi-fi-local-ou-túnel) detalha a escolha e a solução de falhas.

Ao executar o aceite, registre a versão do Expo Go, o celular/Android utilizado, se a conexão foi local ou por túnel e o resultado de abrir, salvar e reabrir. Dados pessoais e endereços temporários de conexão não devem entrar nas evidências versionadas. Sem execução física, DEV-03 e os aceites correspondentes permanecem pendentes no [backlog](BACKLOG.md).

O Expo Go carrega o JavaScript do computador e executa o aplicativo no celular. Teste salvamento, navegação e reabertura manualmente. Não limpar os dados ou desinstalar o aplicativo para verificar persistência. Testes de exclusão e restauração devem usar uma instalação separada com dados sintéticos; não substitua o diário real para testar.

Sem celular acessível, execute os checks no computador e registre o aceite em aparelho como pendente. Os testes Jest/SQLite não abrem dispositivos. Não exportar screenshots com dados pessoais para documentação.

## Roteiro manual da Fase 0

- Abrir pela primeira vez; revisar nome, idade opcional, altura/pesos opcionais e fuso. Tentar nome vazio, decimal com vírgula e fuso inválido; corrigir e continuar.
- Revisar referências e ocultar calorias/macros/peso. Voltar uma etapa e verificar que valores digitados permanecem. Nenhum histórico deve ser criado.
- Escolher tema, água rápida, começo da semana e abrir rotina. Editar dias, horários e nomes de refeições; confirmar perfil.
- Navegar por cinco abas. Hoje mostra os registros reais do dia (vazio antes de registrar); módulos futuros explicam fase e escopo. Onboarding não cria consumo, peso ou treino medido.
- Em Mais, editar perfil e preferências. Salvar e observar feedback; retornar e reabrir. Escuro/claro/sistema devem persistir após encerrar processo.
- Consultar referências com calorias/macros ocultos, sem números desses indicadores. Ativar, salvar e conferir exibição. Ocultar novamente e confirmar que versões permanecem no banco.
- Em dispositivo, conferir teclado, voltar Android, campos finais, scroll com fonte ampliada, alvos de toque e leitura por TalkBack. Repetir em tela pequena. Esses itens exigem validação específica; não inferir aprovação pelo Jest.
- Em APK release, desligar rede desde o primeiro acesso e repetir salvar/reabrir. Expo Go depende do ambiente de desenvolvimento e não prova cold start offline do APK.

## Fase 1: diário, água e backup

No celular, selecione uma data e registre uma refeição descritiva, água rápida e volume personalizado. Confira o desfazer, feche o aplicativo e reabra para verificar a persistência. Use os passos abaixo para completar o aceite, preservando os registros pessoais. As evidências antigas de emulador em [DELIVERY.md](DELIVERY.md) são históricas e não autorizam novas execuções nesse ambiente.

Complemento manual obrigatório para aceite completo:

- Cadastrar alimento sintético com 130 kcal/100 g e fonte sintética identificada; registrar 150 g, conferir 195 kcal e editar para 200 g (260 kcal). Alterar catálogo e conferir que a refeição anterior permanece igual. Repetir a outra data e editar somente a cópia.
- Adicionar item sem nutrientes e zero declarado; verificar subtotal parcial e diferença entre desconhecido/zero. Desativar calorias/macros e verificar diário, receitas e dashboard.
- Criar equivalência explícita de porção; conferir ausência de conversão mL→g sem equivalência. Buscar favorito/recente e arquivar sem apagar histórico.
- Criar receita com ingredientes, rendimento final em g; conferir porção e dados faltantes. Repetir com número de porções. Criar/editar modelo e confirmar que não existe consumo até salvar a refeição.
- Registrar 250 + 500 + 300 mL, conferir 1.050 mL. Registrar outra bebida e confirmar que não aumenta água pura. Corrigir horário/data e desfazer um evento específico.
- Salvar JSON pelo seletor do sistema. Escolhê-lo, conferir prévia e oferta de backup atual; somente depois digitar `SUBSTITUIR`. Conferir retorno dos dados. Importar arquivo inválido e versão futura e verificar preservação. Não restaurar sobre dados reais durante testes.
- Com o bundle já aberto no celular físico, desativar rede e verificar os registros locais. Validar cold start independente do Metro em APK somente na Fase 4.
- Repetir em tema claro/escuro, teclado aberto, fonte ampliada, tela pequena e TalkBack. Verificar botões de desfazer e alertas acessíveis.

Os testes automáticos de SQLite usam exclusivamente arquivos temporários reais, incluindo upgrade 1→2, falha DDL, persistência, transação de agregados, snapshots/cópia, água, fuso, backup round-trip e rollback durante substituição. Os testes de componentes cobrem refeição descritiva, erro de gravação e confirmação/validação do backup. Esses resultados não substituem os passos manuais acima.

## Gates das próximas fases

Fase 1 mantém seus aceites Android ainda pendentes em [DELIVERY.md](DELIVERY.md); Fase 2 adicionará recuperação de sessão/timer; Fase 3, médias/sono/cobertura; Fase 4, regressão completa e distribuição. Os casos estão enumerados no [backlog](BACKLOG.md). Não marcar esses gates como feitos por executar apenas testes no host.
