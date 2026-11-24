import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const input =
  process.env.EVOLUCAO_PRESET_PATH ?? new URL('../.private/onboarding.json', import.meta.url);
const output = new URL('../src/generated/private-onboarding.ts', import.meta.url);
const preset = existsSync(input) ? JSON.parse(readFileSync(input, 'utf8')) : {};
mkdirSync(fileURLToPath(new URL('../src/generated/', import.meta.url)), { recursive: true });
writeFileSync(
  output,
  `// Gerado localmente. Não versionar.\nexport const privateOnboardingPreset: unknown = ${JSON.stringify(preset, null, 2)};\n`,
);
