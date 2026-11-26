import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { DatabaseQueue } from '../core/database/connection.ts';
import { migrateDatabase, migrations } from '../core/database/migrate.ts';
import { BackupRepository } from '../core/database/repositories/backup-repository.ts';
import { EvolutionRepository } from '../core/database/repositories/evolution-repository.ts';
import { ProfileRepository } from '../core/database/repositories/profile-repository.ts';
import { ReminderRepository } from '../core/database/repositories/reminder-repository.ts';
import { backupTables } from '../domain/backup/backup.ts';
import { syntheticSetup } from './fixtures.ts';
import { connect } from './sqlite-test-connection.ts';

const tempDirs: string[] = [];
const createTempDbPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'evolucao-f4-'));
  tempDirs.push(dir);
  return join(dir, 'test.db');
};

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Fase 4 — Robustez e distribuição (SQLite real)', () => {
  it('executa upgrade 4 -> 5 preservando perfil e grava lembretes, CSV seguro, round-trip v5 e exclusão total', async () => {
    const dbPath = createTempDbPath();
    const { db, native } = connect(dbPath);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);',
      );
      for (const m of migrations.filter((item) => item.version <= 4)) {
        await db.execAsync(m.sql);
        await db.runAsync(
          'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          m.version,
          new Date().toISOString(),
        );
      }
    });

    const queue = new DatabaseQueue(db);
    const profileRepo = new ProfileRepository(queue, randomUUID);
    await profileRepo.create(syntheticSetup());

    await migrateDatabase(db);
    const snapshot = await profileRepo.read();
    assert.ok(snapshot);

    const reminderRepo = new ReminderRepository(queue, randomUUID);
    const waterReminder = await reminderRepo.upsert(snapshot.profile.id, {
      category: 'water',
      enabled: true,
      localTime: '10:00',
      weekdays: [1, 3, 5],
      quietStart: '22:30',
      quietEnd: '07:30',
    });
    await reminderRepo.updateNotificationIds(waterReminder.id, ['notif-1', 'notif-2']);
    const listedReminders = await reminderRepo.list(snapshot.profile.id);
    assert.equal(listedReminders.length, 1);
    assert.deepEqual(listedReminders[0]!.platformNotificationIds, ['notif-1', 'notif-2']);

    const evolutionRepo = new EvolutionRepository(queue);
    await evolutionRepo.saveWeight(snapshot.profile.id, {
      id: randomUUID(),
      localDate: '2026-04-08',
      occurredAt: '2026-04-08T10:00:00.000Z',
      timezoneAtEntry: 'America/Sao_Paulo',
      weightKg: 85.5,
      notes: '=SUM(A1:A2)',
    });

    const backupRepo = new BackupRepository(queue);
    const csv = await backupRepo.exportCsvModule('weight');
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes("'=SUM(A1:A2)"));
    assert.ok(csv.includes('85.5'));

    const exported = await backupRepo.export();
    assert.equal(exported.schemaVersion, 5);
    assert.equal(exported.tables.reminders.length, 1);
    assert.equal(exported.tables.weight_entries.length, 1);

    await backupRepo.eraseAllData();
    assert.equal(await profileRepo.read(), null);
    for (const table of backupTables) {
      const count = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      assert.equal(count?.n, 0, `Tabela ${table} deveria estar vazia após exclusão total`);
    }

    await backupRepo.restore(exported);
    const restoredSnapshot = await profileRepo.read();
    assert.equal(restoredSnapshot?.profile.id, snapshot.profile.id);
    assert.equal((await reminderRepo.list(snapshot.profile.id)).length, 1);

    // Aceita backup antigo v2 na restauração.
    const v2Backup = {
      format: 'evolucao-local' as const,
      formatVersion: 1 as const,
      schemaVersion: 2 as const,
      exportedAt: exported.exportedAt,
      tables: {
        profile: exported.tables.profile,
        preferences: exported.tables.preferences,
        goal_versions: exported.tables.goal_versions,
        foods: [],
        food_portions: [],
        recipes: [],
        recipe_items: [],
        meal_templates: [],
        meal_template_items: [],
        meals: [],
        meal_items: [],
        water_entries: [],
      },
    };
    await backupRepo.restore(v2Backup);
    const fromV2 = await profileRepo.read();
    assert.ok(fromV2);
    assert.equal((await reminderRepo.list(fromV2.profile.id)).length, 0);

    // Rejeita versão futura sem apagar os dados atuais.
    await assert.rejects(() =>
      backupRepo.restore({
        ...exported,
        schemaVersion: 6,
      }),
    );
    assert.ok(await profileRepo.read());

    native.close();
  });
});
