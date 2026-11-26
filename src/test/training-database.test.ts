import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { migrateDatabase } from '../core/database/migrate.ts';
import { BackupRepository } from '../core/database/repositories/backup-repository.ts';
import { TrainingRepository } from '../core/database/repositories/training-repository.ts';
import { parseBackup } from '../domain/backup/backup.ts';
import {
  buildTrainingSeedBundle,
  calculateSessionVolume,
  computeRemainingRestSeconds,
  startRestTimer,
  summarizeCardioDay,
  type WorkoutSession,
} from '../domain/training/training.ts';
import { syntheticSetup } from './fixtures.ts';
import { connect } from './sqlite-test-connection.ts';

async function initialized(path?: string) {
  const c = connect(path);
  await migrateDatabase(c.db);
  await c.repo.create(syntheticSetup());
  const profileId = (await c.repo.read())!.profile.id;
  return {
    ...c,
    profileId,
    training: new TrainingRepository(c.queue),
    backup: new BackupRepository(c.queue),
  };
}

test('upgrade 2→3, sessão ativa única, retomada após reabertura e timer absoluto', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'evolucao-reopen-'));
  const file = join(dir, 'test.db');
  const ctx = await initialized(file);
  try {
    const bundle = buildTrainingSeedBundle(randomUUID);
    await ctx.training.applySeedBundle(ctx.profileId, bundle);

    const template = bundle.templates[0]!;
    const sessionId = randomUUID();
    const nowMs = Date.now();
    const session: WorkoutSession = {
      id: sessionId,
      templateId: template.id,
      localDate: '2026-11-26',
      startedAt: new Date(nowMs).toISOString(),
      completedAt: null,
      timezoneAtEntry: 'America/Sao_Paulo',
      status: 'active',
      title: template.name,
      sourceTemplateName: template.name,
      notes: '',
      restTimer: startRestTimer(120, nowMs),
      exercises: [
        {
          id: randomUUID(),
          exerciseId: bundle.exercises[0]!.id,
          name: bundle.exercises[0]!.name,
          muscleGroup: bundle.exercises[0]!.muscleGroup,
          equipment: bundle.exercises[0]!.equipment,
          loadConvention: 'total',
          restSeconds: 90,
          notes: '',
          sets: [
            {
              id: randomUUID(),
              setType: 'working',
              reps: 12,
              loadKg: 30,
              rir: 2,
              rpe: 8,
              status: 'completed',
              completedAt: new Date(nowMs).toISOString(),
            },
            {
              id: randomUUID(),
              setType: 'working',
              reps: 12,
              loadKg: 30,
              rir: 2,
              rpe: 8,
              status: 'completed',
              completedAt: new Date(nowMs).toISOString(),
            },
          ],
        },
      ],
    };

    await ctx.training.startSession(ctx.profileId, session);

    // Não permite segunda sessão ativa simultânea
    await assert.rejects(
      ctx.training.startSession(ctx.profileId, { ...session, id: randomUUID() }),
      /Já existe um treino em andamento/,
    );

    // Editar ou arquivar exercício/ficha não altera snapshot da sessão ativa
    await ctx.training.setExerciseArchived(ctx.profileId, bundle.exercises[0]!.id, true);
    await ctx.training.setTemplateArchived(ctx.profileId, template.id, true);

    // Fecha e reabre o arquivo SQLite
    ctx.native.close();
    const reopened = connect(file);
    await migrateDatabase(reopened.db);
    const trainingReopened = new TrainingRepository(reopened.queue);
    const resumed = await trainingReopened.activeSession(ctx.profileId);

    assert.ok(resumed);
    assert.equal(resumed.id, sessionId);
    assert.equal(calculateSessionVolume(resumed.exercises).volumeKgReps, 720);
    assert.ok(computeRemainingRestSeconds(resumed.restTimer, nowMs + 10_000) >= 109);
    reopened.native.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelamento não conta como concluído e localDate às 23h50 é preservada', async () => {
  const ctx = await initialized();
  const sessionId = randomUUID();
  await ctx.training.startSession(ctx.profileId, {
    id: sessionId,
    templateId: null,
    localDate: '2026-11-26',
    startedAt: '2026-11-27T02:50:00.000Z',
    completedAt: null,
    timezoneAtEntry: 'America/Sao_Paulo',
    status: 'active',
    title: 'Treino noturno',
    sourceTemplateName: null,
    notes: '',
    restTimer: { targetEndAt: null, durationSeconds: 0 },
    exercises: [],
  });
  await ctx.training.cancelSession(ctx.profileId, sessionId);

  const completed = await ctx.training.history(ctx.profileId, { status: 'completed' });
  const cancelled = await ctx.training.history(ctx.profileId, { status: 'cancelled' });
  assert.equal(completed.length, 0);
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0]!.localDate, '2026-11-26');
  ctx.native.close();
});

test('cardio vinculado é preservado ao desvincular e não gera duplicidade; round-trip backup v3', async () => {
  const ctx = await initialized();
  const sessionId = randomUUID();
  await ctx.training.startSession(ctx.profileId, {
    id: sessionId,
    templateId: null,
    localDate: '2026-11-26',
    startedAt: '2026-11-26T15:00:00.000Z',
    completedAt: null,
    timezoneAtEntry: 'America/Sao_Paulo',
    status: 'active',
    title: 'Treino com cardio',
    sourceTemplateName: null,
    notes: '',
    restTimer: { targetEndAt: null, durationSeconds: 0 },
    exercises: [],
  });
  await ctx.training.completeSession(ctx.profileId, sessionId);

  const cardioId = randomUUID();
  await ctx.training.saveCardio(ctx.profileId, {
    id: cardioId,
    sessionId,
    localDate: '2026-11-26',
    occurredAt: '2026-11-26T16:00:00.000Z',
    timezoneAtEntry: 'America/Sao_Paulo',
    durationMinutes: 30,
    distanceKm: 3.2,
    modality: 'treadmill',
    intensity: 'moderate',
    notes: '',
  });
  await ctx.training.unlinkCardio(ctx.profileId, cardioId);

  const dayCardio = await ctx.training.cardioByDate(ctx.profileId, '2026-11-26');
  assert.equal(dayCardio.length, 1);
  assert.equal(dayCardio[0]!.sessionId, null);
  assert.equal(summarizeCardioDay(dayCardio).totalMinutes, 30);

  const exported = await ctx.backup.export();
  assert.equal(exported.schemaVersion, 5);
  const reparsed = parseBackup(JSON.stringify(exported));
  await ctx.backup.restore(reparsed);
  const afterRestore = await ctx.training.cardioByDate(ctx.profileId, '2026-11-26');
  assert.equal(afterRestore.length, 1);
  assert.equal(afterRestore[0]!.durationMinutes, 30);

  ctx.native.close();
});
