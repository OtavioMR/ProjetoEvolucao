import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseQueue, type SqlConnection, type SqlValue } from '../core/database/connection.ts';
import { ProfileRepository } from '../core/database/repositories/profile-repository.ts';

/** Sempre SQLite real em arquivo temporário; nunca conecta ao banco do aplicativo. */
export function connect(path?: string) {
  const folder = path ? null : mkdtempSync(join(tmpdir(), 'evolucao-test-'));
  const native = new DatabaseSync(path ?? join(folder!, 'test.db'));
  const originalClose = native.close.bind(native);
  native.close = () => {
    originalClose();
    if (folder) {
      const resolved = resolve(folder);
      if (
        dirname(resolved) !== resolve(tmpdir()) ||
        !basename(resolved).startsWith('evolucao-test-')
      )
        throw new Error('unsafe_test_cleanup');
      rmSync(resolved, { recursive: true, force: true });
    }
  };
  const db: SqlConnection = {
    async execAsync(sql) {
      native.exec(sql);
    },
    async runAsync(sql, ...params) {
      const r = native.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
      return (native.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: SqlValue[]) {
      return native.prepare(sql).all(...params) as T[];
    },
    async withTransactionAsync(work) {
      native.exec('BEGIN');
      try {
        await work();
        native.exec('COMMIT');
      } catch (e) {
        native.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const queue = new DatabaseQueue(db);
  return {
    db,
    native,
    queue,
    repo: new ProfileRepository(queue, randomUUID, () => new Date('2026-04-08T02:50:00.000Z')),
  };
}
