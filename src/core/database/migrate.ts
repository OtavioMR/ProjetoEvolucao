import type { SqlConnection } from './connection.ts';
import { foundationSql } from './migrations/001-foundation.ts';

export const migrations = [{ version: 1, sql: foundationSql }];
export const schemaVersion = 1;

export async function migrateDatabase(db: SqlConnection): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (foreignKeys?.foreign_keys !== 1) throw new Error('foreign_keys_unavailable');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);',
    );
    const applied = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    if (applied.some((row, i) => row.version !== i + 1 || row.version > schemaVersion))
      throw new Error('unsupported_schema_version');
    for (const migration of migrations) {
      if (applied.some((row) => row.version === migration.version)) continue;
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
        migration.version,
        new Date().toISOString(),
      );
    }
  });
}
