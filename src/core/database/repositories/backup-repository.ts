import {
  backupTables,
  validateBackup,
  type Backup,
  type BackupRow,
} from '../../../domain/backup/backup.ts';
import { DatabaseQueue } from '../connection.ts';

export class BackupRepository {
  private readonly queue: DatabaseQueue;
  constructor(queue: DatabaseQueue) {
    this.queue = queue;
  }
  export(): Promise<Backup> {
    return this.queue.transaction(async (db) => {
      const tables: Record<string, BackupRow[]> = {};
      for (const table of backupTables)
        tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table} ORDER BY rowid`);
      return validateBackup({
        format: 'evolucao-local',
        formatVersion: 1,
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        tables,
      });
    });
  }
  async restore(input: unknown): Promise<void> {
    const backup = validateBackup(input);
    // Congela a cópia validada para não permitir mutações durante a espera pela fila.
    const tables = JSON.parse(JSON.stringify(backup.tables)) as Backup['tables'];
    await this.queue.transaction(async (db) => {
      for (const table of [...backupTables].reverse()) await db.runAsync(`DELETE FROM ${table}`);
      for (const table of backupTables) {
        for (const row of tables[table]) {
          const columns = Object.keys(row);
          // Nomes vieram exclusivamente dos schemas strict e da lista estática de tabelas.
          await db.runAsync(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            ...columns.map((key) => row[key]!),
          );
        }
      }
      if ((await db.getAllAsync('PRAGMA foreign_key_check')).length)
        throw new Error('Backup contém vínculos inválidos.');
    });
  }
}
