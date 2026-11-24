import assert from 'node:assert/strict';
import { dump, fill, find, run, tap, tapTab, top, wait } from './android-ui.mjs';

// Não executa onboarding nem altera perfil real. Só aceita o perfil sintético preexistente.
if (dump().some((n) => n.text === 'TOOLS')) run('shell', 'input', 'keyevent', '4');
await tapTab('Hoje');
await top();
await find('Olá, Pessoa de teste.');
const title = `Teste F1 ${Date.now()}`;
await tapTab('Alimentação');
await top();
await tap('Selecionar outra data');
await fill('Outra data (AAAA-MM-DD)', '2026-04-07');
await tap('Consultar data');
await tap('Registrar refeição', true);
await fill('Título da refeição', title);
await fill('Horário da refeição (HH:mm)', '23:50', true);
await fill('Buscar alimento ou descrever o que comeu', 'Alimento sintetico', true);
await fill('Porção aproximada (opcional)', 'Um prato', true);
await tap('Adicionar como descrição, sem pesar', true);
await tap('Salvar refeição', true);
await top();
await find('Seu diário alimentar.');
await find(title, true);
console.log('PASS Android: refeição descritiva retroativa persistida pela UI.');
await top();
await tapTab('Mais');
await top();
await tap('Água e outras bebidas');
await top();
await find('Dia consultado · 07/04/2026');
await tap('+ 250 mL de água', true);
await tap('+ 500 mL de água', true);
await find('750 mL registrados');
await tap('Desfazer último copo (07/04/2026)', true);
await find('250 mL registrados');
await tap('Registrar volume, data ou outra bebida', true);
await fill('Volume (mL)', '300', true);
await tap('Salvar bebida', true);
await top();
await find('550 mL registrados');
console.log('PASS Android: água rápida, volume personalizado e desfazer por ID.');
run('shell', 'am', 'force-stop', 'host.exp.exponent');
const port = process.env.EVOLUCAO_METRO_PORT ?? '8081';
for (let i = 0; i < 2; i++) {
  run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `exp://127.0.0.1:${port}`);
  await wait(1800);
}
if (dump().some((n) => n.text === 'TOOLS')) run('shell', 'input', 'keyevent', '4');
await find('Olá, Pessoa de teste.');
await tapTab('Alimentação');
await top();
await tap('Selecionar outra data');
await fill('Outra data (AAAA-MM-DD)', '2026-04-07');
await tap('Consultar data');
await find(title, true);
await top();
await tapTab('Mais');
await top();
await tap('Água e outras bebidas');
await top();
await find('550 mL registrados');
console.log('PASS Android: refeição e água recuperadas após encerrar/reabrir o processo.');
run('shell', 'input', 'keyevent', '4');
await tapTab('Mais');
await top();
await tap('Backup local', true);
await tap('Exportar backup JSON', true);
const nodes = dump();
assert.ok(
  nodes.some(
    (n) =>
      n['resource-id'].includes('resolver') ||
      n.text?.includes('backup-') ||
      n.text?.includes('Compartilhar') ||
      n.text?.includes('Bluetooth'),
  ),
  'Folha de compartilhamento deve abrir.',
);
console.log('PASS Android: arquivo JSON criado e seletor de compartilhamento aberto.');
run('shell', 'input', 'keyevent', '4');
