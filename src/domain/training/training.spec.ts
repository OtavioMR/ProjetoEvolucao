import { randomUUID } from 'node:crypto';
import {
  adjustRestTimer,
  buildTrainingSeedBundle,
  calculateExerciseVolume,
  calculateSessionVolume,
  computeComparableRecords,
  computeRemainingRestSeconds,
  resolvePlannedDay,
  startRestTimer,
  summarizeCardioDay,
  type CardioEntry,
  type TrainingPlanVersion,
  type WorkoutSession,
  type WorkoutSet,
} from './training';

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: randomUUID(),
    setType: 'working',
    reps: 12,
    loadKg: 30,
    rir: 2,
    rpe: 8,
    status: 'completed',
    completedAt: '2026-11-26T15:00:00.000Z',
    ...overrides,
  };
}

describe('training domain', () => {
  it('calcula volume de duas séries de 30 kg × 12 reps = 720 kg·reps e ignora puladas/aquecimento', () => {
    const sets = [
      makeSet({ setType: 'warmup', loadKg: 15, reps: 10 }),
      makeSet({ loadKg: 30, reps: 12, status: 'completed' }),
      makeSet({ loadKg: 30, reps: 12, status: 'completed' }),
      makeSet({ loadKg: 30, reps: 12, status: 'skipped', completedAt: null }),
    ];
    expect(calculateExerciseVolume(sets)).toBe(720);
    expect(calculateExerciseVolume(sets, { includeWarmup: true })).toBe(870);

    const sessionSummary = calculateSessionVolume([
      {
        id: randomUUID(),
        exerciseId: randomUUID(),
        name: 'Supino',
        muscleGroup: 'chest',
        equipment: 'Máquina',
        loadConvention: 'total',
        restSeconds: 90,
        notes: '',
        sets,
      },
    ]);
    expect(sessionSummary).toEqual({
      volumeKgReps: 720,
      completedSets: 3,
      skippedSets: 1,
      pendingSets: 0,
      totalSets: 4,
    });
  });

  it('mantém timer absoluto determinístico após salto de tempo', () => {
    const t0 = Date.parse('2026-11-26T15:00:00.000Z');
    const timer = startRestTimer(90, t0);
    expect(computeRemainingRestSeconds(timer, t0 + 35_000)).toBe(55);
    const adjusted = adjustRestTimer(timer, 15, t0 + 35_000);
    expect(computeRemainingRestSeconds(adjusted, t0 + 35_000)).toBe(70);
    expect(computeRemainingRestSeconds(adjusted, t0 + 120_000)).toBe(0);
  });

  it('resolve agenda versionada e exceções diárias sem alterar passado', () => {
    const bundle = buildTrainingSeedBundle(randomUUID);
    const tplA = bundle.templates[1]!;
    const tplB = bundle.templates[2]!;
    const plan: TrainingPlanVersion = {
      id: randomUUID(),
      name: 'AB',
      effectiveFromDate: '2026-11-01',
      effectiveToDate: null,
      slots: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        kind: dayOfWeek === 4 ? 'template' : 'rest',
        templateId: dayOfWeek === 4 ? tplA.id : null,
      })),
      notes: '',
    };

    // 2026-11-26 é quinta-feira (4)
    const planned = resolvePlannedDay('2026-11-26', [plan], [], bundle.templates);
    expect(planned.kind).toBe('template');
    expect(planned.template?.id).toBe(tplA.id);

    const swapped = resolvePlannedDay(
      '2026-11-26',
      [plan],
      [{ id: randomUUID(), localDate: '2026-11-26', kind: 'swap', templateId: tplB.id, notes: '' }],
      bundle.templates,
    );
    expect(swapped.template?.id).toBe(tplB.id);

    const rested = resolvePlannedDay(
      '2026-11-26',
      [plan],
      [{ id: randomUUID(), localDate: '2026-11-26', kind: 'rest', templateId: null, notes: '' }],
      bundle.templates,
    );
    expect(rested.kind).toBe('rest');
  });

  it('calcula recordes comparáveis apenas com mesma convenção de carga e sessões concluídas', () => {
    const exId = randomUUID();
    const sessions: WorkoutSession[] = [
      {
        id: randomUUID(),
        templateId: null,
        localDate: '2026-11-20',
        startedAt: '2026-11-20T12:00:00.000Z',
        completedAt: '2026-11-20T13:00:00.000Z',
        timezoneAtEntry: 'America/Sao_Paulo',
        status: 'completed',
        title: 'Treino 1',
        sourceTemplateName: null,
        notes: '',
        restTimer: { targetEndAt: null, durationSeconds: 0 },
        exercises: [
          {
            id: randomUUID(),
            exerciseId: exId,
            name: 'Supino',
            muscleGroup: 'chest',
            equipment: 'Máquina',
            loadConvention: 'total',
            restSeconds: 90,
            notes: '',
            sets: [makeSet({ loadKg: 30, reps: 12 })],
          },
        ],
      },
      {
        id: randomUUID(),
        templateId: null,
        localDate: '2026-11-25',
        startedAt: '2026-11-25T12:00:00.000Z',
        completedAt: null,
        timezoneAtEntry: 'America/Sao_Paulo',
        status: 'cancelled',
        title: 'Cancelado',
        sourceTemplateName: null,
        notes: '',
        restTimer: { targetEndAt: null, durationSeconds: 0 },
        exercises: [
          {
            id: randomUUID(),
            exerciseId: exId,
            name: 'Supino',
            muscleGroup: 'chest',
            equipment: 'Máquina',
            loadConvention: 'total',
            restSeconds: 90,
            notes: '',
            sets: [makeSet({ loadKg: 100, reps: 10 })],
          },
        ],
      },
    ];
    const records = computeComparableRecords(sessions, exId, 'total');
    expect(records.maxLoadKg).toBe(30);
    expect(records.maxSetVolume).toBe(360);
    expect(records.comparableSessionsCount).toBe(1);
  });

  it('resume cardio sem duplicidade entre registros independentes e vinculados', () => {
    const id1 = randomUUID();
    const entries: CardioEntry[] = [
      {
        id: id1,
        sessionId: randomUUID(),
        localDate: '2026-11-26',
        occurredAt: '2026-11-26T14:00:00.000Z',
        timezoneAtEntry: 'America/Sao_Paulo',
        durationMinutes: 25,
        distanceKm: 2.5,
        modality: 'treadmill',
        intensity: 'moderate',
        notes: '',
      },
      {
        id: randomUUID(),
        sessionId: null,
        localDate: '2026-11-26',
        occurredAt: '2026-11-26T18:00:00.000Z',
        timezoneAtEntry: 'America/Sao_Paulo',
        durationMinutes: 15,
        distanceKm: null,
        modality: 'walk',
        intensity: 'light',
        notes: '',
      },
    ];
    expect(summarizeCardioDay(entries)).toEqual({
      count: 2,
      totalMinutes: 40,
      totalDistanceKm: 2.5,
    });
  });
});
