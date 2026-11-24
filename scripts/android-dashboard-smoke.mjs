import { dump, find, run, tap, tapTab, top, wait } from './android-ui.mjs';

if (dump().some((n) => n['content-desc'] === 'Navigate up')) run('shell', 'input', 'keyevent', '4');
await tapTab('Hoje');
await top();
await find('Olá, Pessoa de teste.');
const date = dump()
  .find((n) => n.text.startsWith('Dia consultado · '))
  .text.split(' · ')[1]
  .split('/')
  .reverse()
  .join('-');
await tap('+ 250 mL de água', true);
await wait(800);
await tap(`Desfazer último copo (${date.split('-').reverse().join('/')})`, true);
await find('Último copo removido.', true);
console.log('PASS Android: desfazer permanece disponível no dashboard após recarregar dados.');
