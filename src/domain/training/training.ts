import { z } from 'zod';
import { isLocalDate, isTimezone } from '../../core/date-time/local-date.ts';

const id = z.uuid();
const stamp = z.iso.datetime();
const localDate = z.string().refine(isLocalDate, 'Data civil inválida.');
const timezone = z.string().refine(isTimezone, 'Fuso inválido.');
const nonNegFinite = z.number().finite().min(0).max(10000);
const shortText = z.string().trim().max(120);
const longText = z.string().trim().max(1000);

export const loadConventionSchema = z.enum(['total', 'per_side', 'bodyweight', 'assisted']);
export type LoadConvention = z.infer<typeof loadConventionSchema>;
export const loadConventionLabels: Record<LoadConvention, string> = {
  total: 'Carga total (kg)',
  per_side: 'Por lado (kg)',
  bodyweight: 'Peso corporal (+ carga extra)',
  assisted: 'Assistido (contrapeso kg)',
};

export const muscleGroupSchema = z.enum([
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'other',
]);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;
export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Peito',
  back: 'Costas',
  legs: 'Pernas',
  shoulders: 'Ombros',
  arms: 'Braços',
  core: 'Core',
  full_body: 'Corpo inteiro',
  other: 'Outro',
};

export const exerciseSchema = z.object({
  id,
  name: z.string().trim().min(1, 'Informe o nome do exercício.').max(120),
  muscleGroup: muscleGroupSchema,
  equipment: shortText,
  loadConvention: loadConventionSchema,
  defaultRestSeconds: z.number().int().min(0).max(1800),
  notes: longText,
  archived: z.boolean(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const templateCategorySchema = z.enum(['readaptation', 'ab', 'custom']);
export type TemplateCategory = z.infer<typeof templateCategorySchema>;

export const templateExerciseSchema = z.object({
  id,
  exerciseId: id,
  nameSnapshot: z.string().trim().min(1).max(120),
  loadConvention: loadConventionSchema,
  targetSets: z.number().int().min(1).max(20),
  targetRepsText: z.string().trim().min(1).max(40),
  restSeconds: z.number().int().min(0).max(1800),
  notes: longText,
});
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;

export const workoutTemplateSchema = z.object({
  id,
  name: z.string().trim().min(1, 'Informe o nome da ficha.').max(120),
  category: templateCategorySchema,
  notes: longText,
  archived: z.boolean(),
  exercises: z.array(templateExerciseSchema).max(40),
});
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

export const planDaySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  kind: z.enum(['rest', 'template']),
  templateId: id.nullable(),
});
export type PlanDaySlot = z.infer<typeof planDaySlotSchema>;

export const trainingPlanVersionSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  effectiveFromDate: localDate,
  effectiveToDate: localDate.nullable(),
  slots: z.array(planDaySlotSchema).length(7),
  notes: longText,
});
export type TrainingPlanVersion = z.infer<typeof trainingPlanVersionSchema>;

export const trainingDayOverrideSchema = z.object({
  id,
  localDate,
  kind: z.enum(['rest', 'swap']),
  templateId: id.nullable(),
  notes: longText,
});
export type TrainingDayOverride = z.infer<typeof trainingDayOverrideSchema>;

export const setTypeSchema = z.enum(['working', 'warmup', 'backoff']);
export type SetType = z.infer<typeof setTypeSchema>;
export const setStatusSchema = z.enum(['pending', 'completed', 'skipped']);
export type SetStatus = z.infer<typeof setStatusSchema>;

export const workoutSetSchema = z.object({
  id,
  setType: setTypeSchema,
  reps: z.number().int().min(0).max(1000).nullable(),
  loadKg: nonNegFinite.nullable(),
  rir: z.number().int().min(0).max(10).nullable(),
  rpe: z.number().finite().min(1).max(10).nullable(),
  status: setStatusSchema,
  completedAt: stamp.nullable(),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

export const restTimerSchema = z.object({
  targetEndAt: stamp.nullable(),
  durationSeconds: z.number().int().min(0).max(3600),
});
export type RestTimer = z.infer<typeof restTimerSchema>;

export const sessionExerciseSchema = z.object({
  id,
  exerciseId: id.nullable(),
  name: z.string().trim().min(1).max(120),
  muscleGroup: muscleGroupSchema,
  equipment: shortText,
  loadConvention: loadConventionSchema,
  restSeconds: z.number().int().min(0).max(1800),
  notes: longText,
  sets: z.array(workoutSetSchema).max(40),
});
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;

export const sessionStatusSchema = z.enum(['active', 'completed', 'cancelled']);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const workoutSessionSchema = z.object({
  id,
  templateId: id.nullable(),
  localDate,
  startedAt: stamp,
  completedAt: stamp.nullable(),
  timezoneAtEntry: timezone,
  status: sessionStatusSchema,
  title: z.string().trim().min(1).max(120),
  sourceTemplateName: shortText.nullable(),
  notes: longText,
  restTimer: restTimerSchema,
  exercises: z.array(sessionExerciseSchema).max(40),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const cardioModalitySchema = z.enum([
  'walk',
  'treadmill',
  'bike',
  'elliptical',
  'run',
  'swim',
  'other',
]);
export type CardioModality = z.infer<typeof cardioModalitySchema>;
export const cardioModalityLabels: Record<CardioModality, string> = {
  walk: 'Caminhada',
  treadmill: 'Esteira',
  bike: 'Bicicleta',
  elliptical: 'Elíptico',
  run: 'Corrida',
  swim: 'Natação',
  other: 'Outro',
};

export const cardioIntensitySchema = z.enum(['light', 'moderate', 'vigorous']);
export type CardioIntensity = z.infer<typeof cardioIntensitySchema>;
export const cardioIntensityLabels: Record<CardioIntensity, string> = {
  light: 'Leve',
  moderate: 'Moderada',
  vigorous: 'Vigorosa',
};

export const cardioEntrySchema = z.object({
  id,
  sessionId: id.nullable(),
  localDate,
  occurredAt: stamp,
  timezoneAtEntry: timezone,
  durationMinutes: z.number().int().min(1).max(1440),
  distanceKm: z.number().finite().positive().max(500).nullable(),
  modality: cardioModalitySchema,
  intensity: cardioIntensitySchema,
  notes: longText,
});
export type CardioEntry = z.infer<typeof cardioEntrySchema>;

/** Soma carga × repetições apenas de séries concluídas com carga e repetições informadas. */
export function calculateExerciseVolume(
  sets: readonly WorkoutSet[],
  options: { includeWarmup?: boolean } = {},
): number {
  const includeWarmup = options.includeWarmup ?? false;
  let total = 0;
  for (const set of sets) {
    if (set.status !== 'completed') continue;
    if (!includeWarmup && set.setType === 'warmup') continue;
    if (set.loadKg === null || set.reps === null) continue;
    total += set.loadKg * set.reps;
  }
  return Math.round(total * 100) / 100;
}

export function calculateSessionVolume(
  exercises: readonly SessionExercise[],
  options: { includeWarmup?: boolean } = {},
): {
  volumeKgReps: number;
  completedSets: number;
  skippedSets: number;
  pendingSets: number;
  totalSets: number;
} {
  let volumeKgReps = 0;
  let completedSets = 0;
  let skippedSets = 0;
  let pendingSets = 0;
  for (const exercise of exercises) {
    volumeKgReps += calculateExerciseVolume(exercise.sets, options);
    for (const set of exercise.sets) {
      if (set.status === 'completed') completedSets += 1;
      else if (set.status === 'skipped') skippedSets += 1;
      else pendingSets += 1;
    }
  }
  return {
    volumeKgReps: Math.round(volumeKgReps * 100) / 100,
    completedSets,
    skippedSets,
    pendingSets,
    totalSets: completedSets + skippedSets + pendingSets,
  };
}

export function computeRemainingRestSeconds(timer: RestTimer, nowMs = Date.now()): number {
  if (!timer.targetEndAt) return 0;
  const targetMs = Date.parse(timer.targetEndAt);
  if (!Number.isFinite(targetMs)) return 0;
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}

export function startRestTimer(durationSeconds: number, nowMs = Date.now()): RestTimer {
  const clamped = Math.max(0, Math.min(3600, Math.round(durationSeconds)));
  if (clamped === 0) return { targetEndAt: null, durationSeconds: 0 };
  return {
    targetEndAt: new Date(nowMs + clamped * 1000).toISOString(),
    durationSeconds: clamped,
  };
}

export function adjustRestTimer(
  timer: RestTimer,
  deltaSeconds: number,
  nowMs = Date.now(),
): RestTimer {
  const currentRemaining = computeRemainingRestSeconds(timer, nowMs);
  const nextSeconds = Math.max(0, Math.min(3600, currentRemaining + deltaSeconds));
  return startRestTimer(nextSeconds, nowMs);
}

export function dayOfWeekFromLocalDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function resolvePlannedDay(
  date: string,
  versions: readonly TrainingPlanVersion[],
  overrides: readonly TrainingDayOverride[],
  templates: readonly WorkoutTemplate[],
): {
  kind: 'rest' | 'template' | 'unscheduled';
  template: WorkoutTemplate | null;
  override: TrainingDayOverride | null;
  version: TrainingPlanVersion | null;
} {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const version =
    versions.find(
      (v) =>
        v.effectiveFromDate <= date && (v.effectiveToDate === null || v.effectiveToDate >= date),
    ) ?? null;
  const override = overrides.find((o) => o.localDate === date) ?? null;
  if (override) {
    if (override.kind === 'rest') return { kind: 'rest', template: null, override, version };
    const swapped = override.templateId ? (byId.get(override.templateId) ?? null) : null;
    return { kind: swapped ? 'template' : 'unscheduled', template: swapped, override, version };
  }
  if (!version) return { kind: 'unscheduled', template: null, override: null, version: null };
  const dow = dayOfWeekFromLocalDate(date);
  const slot = version.slots.find((s) => s.dayOfWeek === dow);
  if (!slot) return { kind: 'unscheduled', template: null, override: null, version };
  if (slot.kind === 'rest') return { kind: 'rest', template: null, override: null, version };
  const template = slot.templateId ? (byId.get(slot.templateId) ?? null) : null;
  return { kind: template ? 'template' : 'unscheduled', template, override: null, version };
}

export function computeComparableRecords(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  loadConvention: LoadConvention,
): {
  maxLoadKg: number | null;
  maxSetVolume: number | null;
  maxSessionVolume: number | null;
  bestSessionDate: string | null;
  comparableSessionsCount: number;
} {
  let maxLoadKg: number | null = null;
  let maxSetVolume: number | null = null;
  let maxSessionVolume: number | null = null;
  let bestSessionDate: string | null = null;
  let comparableSessionsCount = 0;

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const matching = session.exercises.filter(
      (e) => e.exerciseId === exerciseId && e.loadConvention === loadConvention,
    );
    if (!matching.length) continue;
    let sessionHasCompleted = false;
    let sessionVolume = 0;
    for (const ex of matching) {
      for (const set of ex.sets) {
        if (set.status !== 'completed' || set.setType === 'warmup') continue;
        sessionHasCompleted = true;
        if (set.loadKg !== null) {
          if (maxLoadKg === null || set.loadKg > maxLoadKg) maxLoadKg = set.loadKg;
          if (set.reps !== null) {
            const setVol = Math.round(set.loadKg * set.reps * 100) / 100;
            if (maxSetVolume === null || setVol > maxSetVolume) maxSetVolume = setVol;
            sessionVolume += setVol;
          }
        }
      }
    }
    if (!sessionHasCompleted) continue;
    comparableSessionsCount += 1;
    const roundedSessionVol = Math.round(sessionVolume * 100) / 100;
    if (maxSessionVolume === null || roundedSessionVol > maxSessionVolume) {
      maxSessionVolume = roundedSessionVol;
      bestSessionDate = session.localDate;
    }
  }

  return {
    maxLoadKg,
    maxSetVolume,
    maxSessionVolume,
    bestSessionDate,
    comparableSessionsCount,
  };
}

export function summarizeCardioDay(entries: readonly CardioEntry[]): {
  count: number;
  totalMinutes: number;
  totalDistanceKm: number | null;
} {
  const seen = new Set<string>();
  let count = 0;
  let totalMinutes = 0;
  let distanceSum = 0;
  let hasDistance = false;
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    count += 1;
    totalMinutes += entry.durationMinutes;
    if (entry.distanceKm !== null) {
      hasDistance = true;
      distanceSum += entry.distanceKm;
    }
  }
  return {
    count,
    totalMinutes,
    totalDistanceKm: hasDistance ? Math.round(distanceSum * 100) / 100 : null,
  };
}

/** Catálogo inicial neutro e fichas confirmáveis (readaptação e AB). */
export function buildTrainingSeedBundle(newId: () => string): {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
} {
  const ex = (
    name: string,
    muscleGroup: MuscleGroup,
    equipment: string,
    loadConvention: LoadConvention = 'total',
    defaultRestSeconds = 90,
  ): Exercise => ({
    id: newId(),
    name,
    muscleGroup,
    equipment,
    loadConvention,
    defaultRestSeconds,
    notes: '',
    archived: false,
  });

  const supinoMaq = ex('Supino na máquina', 'chest', 'Máquina');
  const puxadaFrente = ex('Puxada frente', 'back', 'Polia alta');
  const legPress = ex('Leg press 45°', 'legs', 'Máquina', 'total', 120);
  const desenvolvimento = ex('Desenvolvimento com halteres', 'shoulders', 'Halteres', 'per_side');
  const remadaBaixa = ex('Remada baixa', 'back', 'Polia');
  const mesaFlexora = ex('Mesa flexora', 'legs', 'Máquina');
  const roscaDireta = ex('Rosca direta', 'arms', 'Barra / halteres', 'total', 60);
  const tricepsPolia = ex('Tríceps na polia', 'arms', 'Polia', 'total', 60);
  const prancha = ex('Prancha abdominal', 'core', 'Peso corporal', 'bodyweight', 60);

  const exercises = [
    supinoMaq,
    puxadaFrente,
    legPress,
    desenvolvimento,
    remadaBaixa,
    mesaFlexora,
    roscaDireta,
    tricepsPolia,
    prancha,
  ];

  const makeItem = (
    exercise: Exercise,
    targetSets: number,
    targetRepsText: string,
  ): TemplateExercise => ({
    id: newId(),
    exerciseId: exercise.id,
    nameSnapshot: exercise.name,
    loadConvention: exercise.loadConvention,
    targetSets,
    targetRepsText,
    restSeconds: exercise.defaultRestSeconds,
    notes: '',
  });

  const templates: WorkoutTemplate[] = [
    {
      id: newId(),
      name: 'Readaptação — Corpo inteiro',
      category: 'readaptation',
      notes: 'Volume moderado para retomada gradual sem sobrecarga.',
      archived: false,
      exercises: [
        makeItem(legPress, 2, '12–15'),
        makeItem(supinoMaq, 2, '12–15'),
        makeItem(puxadaFrente, 2, '12–15'),
        makeItem(desenvolvimento, 2, '12'),
        makeItem(prancha, 2, '30–45s'),
      ],
    },
    {
      id: newId(),
      name: 'Treino A — Superiores',
      category: 'ab',
      notes: 'Empurrar e puxar para membros superiores.',
      archived: false,
      exercises: [
        makeItem(supinoMaq, 3, '8–12'),
        makeItem(puxadaFrente, 3, '8–12'),
        makeItem(desenvolvimento, 3, '10–12'),
        makeItem(remadaBaixa, 3, '10–12'),
        makeItem(roscaDireta, 2, '10–12'),
        makeItem(tricepsPolia, 2, '10–12'),
      ],
    },
    {
      id: newId(),
      name: 'Treino B — Inferiores e Core',
      category: 'ab',
      notes: 'Base de membros inferiores e estabilidade de tronco.',
      archived: false,
      exercises: [
        makeItem(legPress, 3, '10–12'),
        makeItem(mesaFlexora, 3, '10–12'),
        makeItem(prancha, 3, '30–60s'),
      ],
    },
  ];

  return { exercises, templates };
}
