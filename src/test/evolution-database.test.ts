import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { DatabaseQueue } from '../core/database/connection.ts';
import { migrateDatabase, migrations } from '../core/database/migrate.ts';
import { BackupRepository } from '../core/database/repositories/backup-repository.ts';
import { EvolutionRepository } from '../core/database/repositories/evolution-repository.ts';
import { ProfileRepository } from '../core/database/repositories/profile-repository.ts';
import {
  computeSleepInstants,
  dailyWeightSeries,
  summarizeSleepDay,
  weightChangeFromReference,
} from '../domain/evolution/evolution.ts';
import { syntheticSetup } from './fixtures.ts';
import { connect } from './sqlite-test-connection.ts';

const tempDirs: string[] = [];
const createTempDbPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'evolucao-f3-'));
  tempDirs.push(dir);
  return join(dir, 'test.db');
};

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Fase 3 — Evolução (SQLite real)', () => {
  it('executa upgrade 3 -> 4 preservando perfil e grava peso/sono/hábitos/metas sem sobreposição', async () => {
    const dbPath = createTempDbPath();
    const { db, native } = connect(dbPath);
    // Simula banco na versão 3 antes do upgrade.
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);',
      );
      for (const m of migrations.filter((item) => item.version <= 3)) {
        await db.execAsync(m.sql);
        await db.runAsync(
          'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          m.version,
          '2026-04-08T12:00:00.000Z',
        );
      }
    });

    let seq = 1;
    const nextId = () => `40000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;
    const queue = new DatabaseQueue(db);
    const profileRepo = new ProfileRepository(
      queue,
      nextId,
      () => new Date('2026-04-08T12:00:00.000Z'),
    );
    await profileRepo.create(syntheticSetup());
    const snapBefore = (await profileRepo.read())!;

    // Upgrade 3 -> 4
    await migrateDatabase(db);
    const evolutionRepo = new EvolutionRepository(
      queue,
      () => new Date('2026-04-08T12:00:00.000Z'),
    );

    // Pesagens no mesmo dia: 86,2 às 08h e 85,5 às 20h -> última pesagem = 85,5 kg (-4,5 kg / 5%)
    await evolutionRepo.saveWeight(snapBefore.profile.id, {
      id: nextId(),
      localDate: '2026-04-08',
      occurredAt: '2026-04-08T11:00:00.000Z',
      timezoneAtEntry: 'America/Sao_Paulo',
      weightKg: 86.2,
      notes: '',
    });
    await evolutionRepo.saveWeight(snapBefore.profile.id, {
      id: nextId(),
      localDate: '2026-04-08',
      occurredAt: '2026-04-08T23:00:00.000Z',
      timezoneAtEntry: 'America/Sao_Paulo',
      weightKg: 85.5,
      notes: '',
    });
    const weights = await evolutionRepo.listWeights(snapBefore.profile.id);
    const series = dailyWeightSeries(weights);
    assert.equal(series[0]?.value, 85.5);
    assert.deepEqual(weightChangeFromReference(85.5, 90), {
      deltaKg: -4.5,
      reductionKg: 4.5,
      reductionPct: 5,
    });

    // Sono 23h30 -> 07h30 (8 h) + intervalo sobreposto 06h30 -> 08h30 = 9 h total (não 10 h)
    const s1 = computeSleepInstants('2026-04-08', '23:30', '07:30', 'America/Sao_Paulo');
    const s2 = computeSleepInstants('2026-04-08', '06:30', '08:30', 'America/Sao_Paulo');
    await evolutionRepo.saveSleep(snapBefore.profile.id, {
      id: nextId(),
      ...s1,
      wakeLocalDate: '2026-04-08',
      timezoneAtEntry: 'America/Sao_Paulo',
      isNap: false,
      quality: 4,
      notes: '',
    });
    await evolutionRepo.saveSleep(snapBefore.profile.id, {
      id: nextId(),
      ...s2,
      wakeLocalDate: '2026-04-08',
      timezoneAtEntry: 'America/Sao_Paulo',
      isNap: false,
      quality: 5,
      notes: '',
    });
    const sleepList = await evolutionRepo.listSleep(snapBefore.profile.id, '2026-04-08');
    assert.equal(summarizeSleepDay(sleepList).mainMinutes, 540);

    // Alterar meta de água a partir de amanhã (2026-04-09) preserva meta de hoje (2026-04-08)
    await profileRepo.upsertGoalVersion(snapBefore.profile.id, 'water', 2600, '2026-04-09', true);
    const snapAfterGoal = (await profileRepo.read())!;
    const waterGoals = snapAfterGoal.goals.filter((g) => g.metric === 'water');
    assert.equal(waterGoals.length, 2);
    assert.equal(waterGoals[0]?.effectiveToDate, '2026-04-08');
    assert.equal(waterGoals[0]?.targetValue, 2000);
    assert.equal(waterGoals[1]?.effectiveFromDate, '2026-04-09');
    assert.equal(waterGoals[1]?.targetValue, 2600);

    // Ocultar peso e calorias nas preferências não apaga os registros de peso no banco
    await profileRepo.updatePreferences(snapBefore.profile.id, {
      ...snapAfterGoal.preferences,
      visibility: { ...snapAfterGoal.preferences.visibility, weight: false, calories: false },
    });
    assert.equal((await evolutionRepo.listWeights(snapBefore.profile.id)).length, 2);

    // Backup round-trip v4 em arquivo limpo
    const backupRepo = new BackupRepository(queue);
    const exported = await backupRepo.export();
    assert.equal(exported.schemaVersion, 5);
    assert.equal(exported.tables.weight_entries.length, 2);
    assert.equal(exported.tables.sleep_entries.length, 2);

    const restorePath = createTempDbPath();
    const { db: restoreDb, native: restoreNative } = connect(restorePath);
    await migrateDatabase(restoreDb);
    const restoreQueue = new DatabaseQueue(restoreDb);
    const restoreBackup = new BackupRepository(restoreQueue);
    await restoreBackup.restore(exported);
    const restoredWeights = await new EvolutionRepository(restoreQueue).listWeights(
      snapBefore.profile.id,
    );
    assert.equal(restoredWeights.length, 2);

    native.close();
    restoreNative.close();
  });
});
