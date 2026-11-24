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

## Android: sessão de teste isolada

Use emulador novo/sandbox sem dados reais. Não limpar dados de um perfil existente. O script de smoke aborta se não encontrar a fixture sintética na primeira etapa; não reinicializa banco automaticamente.

1. Crie fixture local ignorada:

```powershell
New-Item -ItemType Directory -Force .private | Out-Null
@'
import { writeFileSync } from 'node:fs';
import { syntheticSetup } from './src/test/fixtures.ts';
writeFileSync('.private/test-onboarding.json', JSON.stringify(syntheticSetup()));
'@ | node --input-type=module -
$env:EVOLUCAO_PRESET_PATH = '.private/test-onboarding.json'
npm.cmd run prepare
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm.cmd run android
```

2. Com a primeira etapa aberta, em outro terminal:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:EVOLUCAO_ANDROID_SMOKE = '1'
node scripts/android-smoke.mjs
```

O roteiro ADB foi escrito para AVD de 1080 × 2400 px. Verifica onboarding, cinco abas, edição de tema e encerramento/reabertura do Expo Go. UIAutomator consulta textos/rótulos acessíveis. Não usar coordenadas deste script em aparelho pessoal. Se o Expo Go exibir seu menu de desenvolvimento sobre a tela, feche-o antes de executar. Para repetir apenas a parte pós-onboarding, abra a aba Hoje com a fixture sintética já persistida e acrescente `--resume` ao comando. O script não representa um teste de APK offline.

3. Ao terminar, remova a variável na sessão de desenvolvimento e regenere o preset pessoal/neutro:

```powershell
Remove-Item Env:EVOLUCAO_PRESET_PATH -ErrorAction SilentlyContinue
npm.cmd run prepare
```

O perfil sintético persistido no emulador continua isolado do perfil de um aparelho pessoal. Não exportar screenshots com dados pessoais para documentação.

## Roteiro manual da Fase 0

- Abrir pela primeira vez; revisar nome, idade opcional, altura/pesos opcionais e fuso. Tentar nome vazio, decimal com vírgula e fuso inválido; corrigir e continuar.
- Revisar referências e ocultar calorias/macros/peso. Voltar uma etapa e verificar que valores digitados permanecem. Nenhum histórico deve ser criado.
- Escolher tema, água rápida, começo da semana e abrir rotina. Editar dias, horários e nomes de refeições; confirmar perfil.
- Navegar por cinco abas. Hoje mostra a fundação e atalhos reais; módulos futuros explicam fase e escopo. Nenhum consumo, peso ou treino medido é exibido.
- Em Mais, editar perfil e preferências. Salvar e observar feedback; retornar e reabrir. Escuro/claro/sistema devem persistir após encerrar processo.
- Consultar referências com calorias/macros ocultos, sem números desses indicadores. Ativar, salvar e conferir exibição. Ocultar novamente e confirmar que versões permanecem no banco.
- Em dispositivo, conferir teclado, voltar Android, campos finais, scroll com fonte ampliada, alvos de toque e leitura por TalkBack. Repetir em tela pequena. Esses itens exigem validação específica; não inferir aprovação pelo Jest.
- Em APK release, desligar rede desde o primeiro acesso e repetir salvar/reabrir. Expo Go depende do ambiente de desenvolvimento e não prova cold start offline do APK.

## Gates das próximas fases

Fase 1 adicionará aceites de nutrição/água/backup; Fase 2, recuperação de sessão/timer; Fase 3, médias/sono/cobertura; Fase 4, regressão de todos os módulos, importação com rollback, migrações anteriores e distribuição. Os casos estão enumerados no [backlog](BACKLOG.md). Não marcar esses gates como feitos por executar apenas a suíte da fundação.
