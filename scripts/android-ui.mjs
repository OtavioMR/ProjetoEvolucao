import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

if (process.env.EVOLUCAO_ANDROID_SMOKE !== '1')
  throw new Error('Use apenas no emulador isolado com perfil sintético.');
const adb = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe')
  : 'adb';
const args = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [];
export const run = (...command) =>
  execFileSync(adb, [...args, ...command], {
    encoding: 'utf8',
    timeout: 20000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
export const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
export function dump() {
  run('shell', 'uiautomator', 'dump', '/sdcard/evolucao-smoke.xml');
  return [...run('exec-out', 'cat', '/sdcard/evolucao-smoke.xml').matchAll(/<node\b[^>]+>/g)].map(
    ([raw]) =>
      Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
  );
}
function center(node) {
  const b = [...node.bounds.matchAll(/\d+/g)].map((m) => Number(m[0]));
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}
const exact = (node, text) =>
  node.text === text ||
  node['content-desc'] === text ||
  node['content-desc']?.startsWith(`${text}. `);
export async function find(text, scroll = false, editable = false) {
  if (scroll) await top();
  for (let i = 0; i < 14; i++) {
    const nodes = dump();
    const target = nodes.find(
      (node) =>
        exact(node, text) &&
        (!editable || node.class === 'android.widget.EditText') &&
        center(node)[1] < 2280 &&
        center(node)[1] > 90,
    );
    if (target) return target;
    if (scroll) run('shell', 'input', 'swipe', '540', '1900', '540', '1250', '250');
    await wait();
  }
  throw new Error(`Controle não encontrado: ${text}`);
}
export async function tap(text, scroll = false) {
  const [x, y] = center(await find(text, scroll));
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
  await wait();
}
export async function tapTab(text) {
  const node = dump().find(
    (n) => n['content-desc'] === text && n.class === 'android.view.View' && center(n)[1] > 2150,
  );
  if (!node) throw new Error(`Aba não encontrada: ${text}`);
  const [x, y] = center(node);
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
  await wait();
}
export async function fill(label, value, scroll = false) {
  const node = await find(label, scroll, true);
  const [x, y] = center(node);
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
  run('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
  run(
    'shell',
    'input',
    'keyevent',
    ...Array(Math.max(40, (node.text?.length ?? 0) + 2)).fill('KEYCODE_DEL'),
  );
  if (value) run('shell', 'input', 'text', value.replaceAll(' ', '%s'));
  run('shell', 'input', 'keyevent', '4');
  await wait();
}
export async function top() {
  for (let i = 0; i < 6; i++) run('shell', 'input', 'swipe', '540', '650', '540', '1900', '160');
  await wait();
}
