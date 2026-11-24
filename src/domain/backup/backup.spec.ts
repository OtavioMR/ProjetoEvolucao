import { syntheticBackup } from '../../test/backup-fixture';
import { backupLimit, parseBackup } from './backup';

it('limita tamanho real UTF-8 e recusa JSON inválido', () => {
  expect(() => parseBackup('€'.repeat(Math.ceil(backupLimit / 3)))).toThrow('10 MiB');
  expect(() => parseBackup('{invalid')).toThrow();
});
it('formato atual completa round-trip sem aceitar versões futuras ou tabelas extras', () => {
  const backup = syntheticBackup();
  expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 3 }))).toThrow();
  expect(() =>
    parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, injected: [] } })),
  ).toThrow();
});
