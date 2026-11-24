import { z } from 'zod';

import { isLocalDate, isTimezone } from '../../core/date-time/local-date.ts';

const positiveOptional = z.number().finite().positive().nullable();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.');
export const visibilitySchema = z.object({
  calories: z.boolean(),
  macros: z.boolean(),
  weight: z.boolean(),
  measurements: z.boolean(),
  sleep: z.boolean(),
});
export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Informe como prefere ser chamado.').max(80),
  ageAtSetup: z.number().int().nonnegative().nullable(),
  heightCm: positiveOptional,
  referenceWeightKg: positiveOptional,
  targetWeightKg: positiveOptional,
  timezone: z.string().refine(isTimezone, 'Informe um fuso IANA válido, como America/Sao_Paulo.'),
});
export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  locale: z.literal('pt-BR'),
  visibility: visibilitySchema,
  quickWaterAmounts: z.array(z.number().int().positive().max(10000)).min(1).max(6),
  meals: z
    .array(z.object({ name: z.string().trim().min(1).max(40), time: timeSchema }))
    .min(1)
    .max(10),
  availableDays: z.array(z.number().int().min(0).max(6)).max(7),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  trainingTime: timeSchema,
  sleepStart: timeSchema,
  sleepEnd: timeSchema,
});
export const goalMetricSchema = z.enum([
  'water',
  'energy',
  'protein',
  'carbs',
  'fat',
  'sleep',
  'cardio',
]);
export const initialGoalsSchema = z.object({
  water: positiveOptional,
  energy: positiveOptional,
  protein: positiveOptional,
  carbs: positiveOptional,
  fat: positiveOptional,
  sleep: positiveOptional,
  cardio: positiveOptional,
});
export const setupSchema = z.object({
  profile: profileSchema,
  preferences: preferencesSchema,
  goals: initialGoalsSchema,
});
export const goalSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  metric: goalMetricSchema,
  targetValue: z.number().finite().positive(),
  unit: z.enum(['mL', 'kcal', 'g', 'hours', 'minutes']),
  effectiveFromDate: z.string().refine(isLocalDate),
  effectiveToDate: z.string().refine(isLocalDate).nullable(),
  enabled: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type InitialGoals = z.infer<typeof initialGoalsSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type GoalMetric = z.infer<typeof goalMetricSchema>;
export type Profile = ProfileInput & { id: string; createdAt: string; updatedAt: string };
export type AppSnapshot = { profile: Profile; preferences: Preferences; goals: Goal[] };

export const goalUnits: Record<GoalMetric, Goal['unit']> = {
  water: 'mL',
  energy: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  sleep: 'hours',
  cardio: 'minutes',
};

export function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return NaN;
  return Number(value.trim().replace(',', '.'));
}

export function unusualProfileValues(profile: ProfileInput): boolean {
  return (
    (profile.ageAtSetup !== null && profile.ageAtSetup > 120) ||
    (profile.heightCm !== null && (profile.heightCm < 80 || profile.heightCm > 240)) ||
    [profile.referenceWeightKg, profile.targetWeightKg].some(
      (v) => v !== null && (v < 30 || v > 300),
    )
  );
}
