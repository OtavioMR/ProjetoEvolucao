import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Somente em emulador de teste isolado, com fixture sintética no onboarding.
if (process.env.EVOLUCAO_ANDROID_SMOKE !== '1')
  throw new Error('Defina EVOLUCAO_ANDROID_SMOKE=1 apenas no emulador isolado de testes.');
const adb = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe')
  : 'adb';
const args = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [];
const run = (...command) =>
  execFileSync(adb, [...args, ...command], {
    encoding: 'utf8',
    timeout: 20000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const wait = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));
function dump() {
  run('shell', 'uiautomator', 'dump', '/sdcard/evolucao-smoke.xml');
  const xml = run('exec-out', 'cat', '/sdcard/evolucao-smoke.xml');
  return [...xml.matchAll(/<node\b[^>]+>/g)].map(([raw]) =>
    Object.fromEntries(
      [...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    ),
  );
}
const exact = (node, text) =>
  node.text === text ||
  node['content-desc'] === text ||
  node['content-desc']?.startsWith(`${text}. `) ||
  node['content-desc']?.startsWith(`${text},`);
function center(node) {
  const b = [...node.bounds.matchAll(/\d+/g)].map((m) => Number(m[0]));
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}
async function find(text, scroll = false) {
  for (let i = 0; i < 9; i++) {
    const nodes = dump();
    const target = nodes.find(
      (node) => exact(node, text) && center(node)[1] < 2300 && center(node)[1] > 80,
    );
    if (target) return target;
    if (scroll) run('shell', 'input', 'swipe', '540', '1960', '540', '780', '300');
    await wait();
  }
  throw new Error(`Controle não encontrado: ${text}`);
}
async function tap(text, scroll = false) {
  const node = await find(text, scroll);
  const [x, y] = center(node);
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
  await wait();
}
async function top() {
  for (let i = 0; i < 5; i++) run('shell', 'input', 'swipe', '540', '600', '540', '1900', '200');
  await wait();
}

if (dump().some((node) => node.text === 'TOOLS')) run('shell', 'input', 'keyevent', '4');
if (process.argv.includes('--resume')) {
  await find('Olá, Pessoa de teste.');
} else {
  await find('Pessoa de teste');
  assert.ok(
    dump().some((node) => node.text === 'Pessoa de teste'),
    'Onboarding deve conter somente fixture sintética; execução abortada.',
  );
  await tap('Continuar', true);
  await find('Acompanhe do seu jeito.');
  await tap('Continuar', true);
  await find('Pronto para começar.');
  await tap('Confirmar perfil e começar', true);
  await find('Olá, Pessoa de teste.');
  console.log('PASS Android: onboarding confirmado com fixture sintética.');
}
for (const tab of ['Alimentação', 'Treinos', 'Evolução', 'Mais']) {
  await tap(tab);
}
await tap('Preferências', true);
await find('Preferências');
await tap('Claro', true);
await tap('Salvar alterações', true);
await find('Salvo. As alterações já estão disponíveis no aplicativo.');
console.log('PASS Android: cinco abas, preferências e salvamento.');
run('shell', 'input', 'keyevent', '4');
run('shell', 'am', 'force-stop', 'host.exp.exponent');
run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081');
await wait(1000);
// Expo Go pode abrir primeiro seu launcher após force-stop; reenviar o link é idempotente.
run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081');
await wait(2500);
if (dump().some((node) => node.text === 'TOOLS')) run('shell', 'input', 'keyevent', '4');
await find('Olá, Pessoa de teste.');
await tap('Mais');
await tap('Preferências', true);
await top();
const choice = await find('Claro', true);
assert.ok(choice.selected === 'true', 'Preferência deve estar acessível após reabertura.');
await tap('Salvar alterações', true);
await find('Salvo. As alterações já estão disponíveis no aplicativo.');
console.log('PASS Android: encerramento do processo e reabertura sem onboarding.');
