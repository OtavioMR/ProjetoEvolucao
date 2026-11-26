import { z } from 'zod';

import { eventInstant, shiftDate } from '../../core/date-time/event-time.ts';
import { isLocalDate, isTimezone } from '../../core/date-time/local-date.ts';

const localDateSchema = z.string().refine(isLocalDate, 'Data local inválida.');
const timezoneSchema = z.string().refine(isTimezone, 'Fuso IANA inválido.');
const isoStampSchema = z.iso.datetime();

export const measurementMetrics = [
  'waist',
  'hip',
  'chest',
  'left_arm',
  'right_arm',
  'left_thigh',
  'right_thigh',
  'neck',
] as const;

export type MeasurementMetric = (typeof measurementMetrics)[number];

export const measurementLabels: Record<MeasurementMetric, string> = {
  waist: 'Cintura',
  hip: 'Quadril',
  chest: 'Peito',
  left_arm: 'Braço esquerdo',
  right_arm: 'Braço direito',
  left_thigh: 'Coxa esquerda',
  right_thigh: 'Coxa direita',
  neck: 'Pescoço',
};

export const weightEntrySchema = z.object({
  id: z.uuid(),
  localDate: localDateSchema,
  occurredAt: isoStampSchema,
  timezoneAtEntry: timezoneSchema,
  weightKg: z.number().finite().positive().max(500),
  notes: z.string().max(1000),
});

export const measurementEntrySchema = z.object({
  id: z.uuid(),
  localDate: localDateSchema,
  occurredAt: isoStampSchema,
  timezoneAtEntry: timezoneSchema,
  metric: z.enum(measurementMetrics),
  valueCm: z.number().finite().positive().max(400),
  notes: z.string().max(1000),
});

export const bodyMilestoneSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  targetWeightKg: z.number().finite().positive().max(500),
  achievedAt: isoStampSchema.nullable(),
  notes: z.string().max(1000),
});

export const sleepEntrySchema = z
  .object({
    id: z.uuid(),
    startAt: isoStampSchema,
    endAt: isoStampSchema,
    wakeLocalDate: localDateSchema,
    timezoneAtEntry: timezoneSchema,
    isNap: z.boolean(),
    quality: z.number().int().min(1).max(5).nullable(),
    notes: z.string().max(1000),
  })
  .refine(
    (v) => Date.parse(v.endAt) > Date.parse(v.startAt),
    'Fim do sono deve ser após o início.',
  );

export const habitSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  description: z.string().max(500),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  position: z.number().int().nonnegative(),
  archivedAt: isoStampSchema.nullable(),
});

export const habitLogStatusSchema = z.enum(['done', 'not_done', 'not_applicable']);
export type HabitLogStatus = z.infer<typeof habitLogStatusSchema>;
export type HabitDayState = HabitLogStatus | 'unrecorded';

export const habitLogSchema = z.object({
  id: z.uuid(),
  habitId: z.uuid(),
  localDate: localDateSchema,
  status: habitLogStatusSchema,
  notes: z.string().max(1000),
});

export const weeklyReviewSchema = z.object({
  id: z.uuid(),
  weekStartDate: localDateSchema,
  whatWorked: z.string().max(2000),
  difficulties: z.string().max(2000),
  energyNote: z.string().max(500),
  hungerNote: z.string().max(500),
  preferences: z.string().max(1000),
  adjustments: z.string().max(2000),
});

export type WeightEntry = z.infer<typeof weightEntrySchema>;
export type MeasurementEntry = z.infer<typeof measurementEntrySchema>;
export type BodyMilestone = z.infer<typeof bodyMilestoneSchema>;
export type SleepEntry = z.infer<typeof sleepEntrySchema>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;

export type ChartPeriod = '7d' | '30d' | '90d' | 'total';

export type DailySeriesPoint = {
  localDate: string;
  value: number;
  entryId: string;
};

/** Escolhe a última pesagem de cada dia civil (maior occurredAt) para séries de tendência. */
export function dailyWeightSeries(entries: WeightEntry[]): DailySeriesPoint[] {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of entries) {
    const current = byDate.get(entry.localDate);
    if (!current || Date.parse(entry.occurredAt) >= Date.parse(current.occurredAt)) {
      byDate.set(entry.localDate, entry);
    }
  }
  return [...byDate.values()]
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
    .map((e) => ({ localDate: e.localDate, value: e.weightKg, entryId: e.id }));
}

/** Escolhe a última medida de cada dia civil para a métrica informada. */
export function dailyMeasurementSeries(
  entries: MeasurementEntry[],
  metric: MeasurementMetric,
): DailySeriesPoint[] {
  const byDate = new Map<string, MeasurementEntry>();
  for (const entry of entries) {
    if (entry.metric !== metric) continue;
    const current = byDate.get(entry.localDate);
    if (!current || Date.parse(entry.occurredAt) >= Date.parse(current.occurredAt)) {
      byDate.set(entry.localDate, entry);
    }
  }
  return [...byDate.values()]
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
    .map((e) => ({ localDate: e.localDate, value: e.valueCm, entryId: e.id }));
}

export function weightChangeFromReference(
  currentKg: number | null,
  referenceKg: number | null,
): { deltaKg: number; reductionKg: number; reductionPct: number } | null {
  if (currentKg === null || referenceKg === null || referenceKg <= 0) return null;
  const deltaKg = Number((currentKg - referenceKg).toFixed(2));
  const reductionKg = Number((referenceKg - currentKg).toFixed(2));
  const reductionPct = Number(((reductionKg / referenceKg) * 100).toFixed(2));
  return { deltaKg, reductionKg, reductionPct };
}

export function rollingAverage(
  dailyPoints: DailySeriesPoint[],
  endDate: string,
  days = 7,
): { average: number | null; count: number; totalDays: number } {
  const startDate = shiftDate(endDate, -(days - 1));
  const inRange = dailyPoints.filter((p) => p.localDate >= startDate && p.localDate <= endDate);
  if (inRange.length === 0) return { average: null, count: 0, totalDays: days };
  const sum = inRange.reduce((acc, p) => acc + p.value, 0);
  return {
    average: Number((sum / inRange.length).toFixed(2)),
    count: inRange.length,
    totalDays: days,
  };
}

export function filterSeriesByPeriod(
  dailyPoints: DailySeriesPoint[],
  period: ChartPeriod,
  referenceDate: string,
): DailySeriesPoint[] {
  if (period === 'total') return dailyPoints;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = shiftDate(referenceDate, -(days - 1));
  return dailyPoints.filter((p) => p.localDate >= startDate && p.localDate <= referenceDate);
}

/** Quebra a série em segmentos quando há lacuna maior que maxGapDays para não interpolar ausências. */
export function splitSeriesWithGaps(
  points: DailySeriesPoint[],
  maxGapDays = 3,
): DailySeriesPoint[][] {
  if (points.length === 0) return [];
  const segments: DailySeriesPoint[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const diffDays = Math.round(
      (Date.parse(`${curr.localDate}T12:00:00Z`) - Date.parse(`${prev.localDate}T12:00:00Z`)) /
        86400000,
    );
    if (diffDays <= maxGapDays) {
      segments[segments.length - 1]!.push(curr);
    } else {
      segments.push([curr]);
    }
  }
  return segments;
}

export function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function isUnusualWeight(weightKg: number, previousKg?: number | null): boolean {
  if (weightKg < 30 || weightKg > 300) return true;
  if (previousKg !== undefined && previousKg !== null && Math.abs(weightKg - previousKg) >= 8) {
    return true;
  }
  return false;
}

export function isUnusualMeasurement(valueCm: number): boolean {
  return valueCm < 15 || valueCm > 250;
}

export function defaultMilestoneSuggestions(
  referenceWeightKg: number | null,
  targetWeightKg: number | null,
): { title: string; targetWeightKg: number; notes: string }[] {
  if (referenceWeightKg === null || referenceWeightKg <= 0) return [];
  const fivePct = Number((referenceWeightKg * 0.95).toFixed(1));
  const tenPct = Number((referenceWeightKg * 0.9).toFixed(1));
  const list: { title: string; targetWeightKg: number; notes: string }[] = [
    { title: 'Redução de 5%', targetWeightKg: fivePct, notes: 'Marco inicial de 5%' },
    { title: 'Redução de 10%', targetWeightKg: tenPct, notes: 'Marco de 10%' },
  ];
  if (targetWeightKg !== null && targetWeightKg < tenPct) {
    const mid = Number(((tenPct + targetWeightKg) / 2).toFixed(0));
    if (mid > targetWeightKg && mid < tenPct) {
      list.push({ title: 'Reavaliação intermediária', targetWeightKg: mid, notes: 'Revisão' });
    }
    list.push({ title: 'Objetivo informado', targetWeightKg, notes: 'Meta revisável' });
  }
  return list;
}

/** Soma a união de intervalos UTC em minutos sem duplicar períodos sobrepostos. */
export function mergeUtcIntervalsMinutes(intervals: { startAt: string; endAt: string }[]): number {
  const valid = intervals
    .map((item) => ({ start: Date.parse(item.startAt), end: Date.parse(item.endAt) }))
    .filter(
      (item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start,
    )
    .sort((a, b) => a.start - b.start);
  if (valid.length === 0) return 0;
  let totalMs = 0;
  let currentStart = valid[0]!.start;
  let currentEnd = valid[0]!.end;
  for (let i = 1; i < valid.length; i += 1) {
    const next = valid[i]!;
    if (next.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  totalMs += currentEnd - currentStart;
  return Math.round(totalMs / 60000);
}

export function summarizeSleepDay(entries: SleepEntry[]): {
  mainMinutes: number;
  napMinutes: number;
  totalMinutes: number;
  averageQuality: number | null;
} {
  const main = entries.filter((e) => !e.isNap);
  const naps = entries.filter((e) => e.isNap);
  const mainMinutes = mergeUtcIntervalsMinutes(main);
  const napMinutes = mergeUtcIntervalsMinutes(naps);
  const qualities = entries.map((e) => e.quality).filter((q): q is number => q !== null);
  const averageQuality =
    qualities.length > 0
      ? Number((qualities.reduce((a, b) => a + b, 0) / qualities.length).toFixed(1))
      : null;
  return {
    mainMinutes,
    napMinutes,
    totalMinutes: mainMinutes + napMinutes,
    averageQuality,
  };
}

export function computeSleepInstants(
  wakeLocalDate: string,
  startTime: string,
  endTime: string,
  timezone: string,
): { startAt: string; endAt: string } {
  const startDate = startTime >= endTime ? shiftDate(wakeLocalDate, -1) : wakeLocalDate;
  const startAt = eventInstant(startDate, startTime, timezone);
  const endAt = eventInstant(wakeLocalDate, endTime, timezone);
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error('Horário de término deve ser posterior ao início.');
  }
  return { startAt, endAt };
}

export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export function habitSuggestions(): {
  title: string;
  description: string;
  weekdays: number[];
}[] {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  return [
    {
      title: 'Refeições regulares',
      description: 'Manter horários próximos da rotina',
      weekdays: allDays,
    },
    {
      title: 'Incluir proteína',
      description: 'Fonte proteica nas refeições principais',
      weekdays: allDays,
    },
    { title: 'Frutas e vegetais', description: 'Variedade ao longo do dia', weekdays: allDays },
    { title: 'Hidratação', description: 'Água distribuída ao longo do dia', weekdays: allDays },
    {
      title: 'Atividade planejada',
      description: 'Treino ou cardio conforme plano',
      weekdays: [1, 2, 3, 4, 5, 6],
    },
    {
      title: 'Sono consistente',
      description: 'Rotina de horário para dormir e acordar',
      weekdays: allDays,
    },
    {
      title: 'Observar gatilhos',
      description: 'Registrar fome e contexto sem julgamento',
      weekdays: allDays,
    },
  ];
}

export function habitStateForDate(log: HabitLog | undefined): HabitDayState {
  return log ? log.status : 'unrecorded';
}

export function weekdayOfLocalDate(localDate: string): number {
  return new Date(`${localDate}T12:00:00Z`).getUTCDay();
}

export function weekRangeForDate(
  localDate: string,
  weekStart: 0 | 1,
): { weekStartDate: string; weekEndDate: string; dates: string[] } {
  const day = weekdayOfLocalDate(localDate);
  const diff = (day - weekStart + 7) % 7;
  const weekStartDate = shiftDate(localDate, -diff);
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(weekStartDate, i));
  return { weekStartDate, weekEndDate: dates[6]!, dates };
}

export function monthRange(yearMonth: string): {
  startDate: string;
  endDate: string;
  daysInMonth: number;
} {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
  return { startDate, endDate, daysInMonth };
}

export function monthGridDates(yearMonth: string, weekStart: 0 | 1): (string | null)[] {
  const { startDate, daysInMonth } = monthRange(yearMonth);
  const firstWeekday = weekdayOfLocalDate(startDate);
  const leadingBlanks = (firstWeekday - weekStart + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type PeriodReportInput = {
  startDate: string;
  endDate: string;
  totalDays: number;
  daysWithAnyData: number;
  completedWorkouts: number;
  plannedWorkouts: number;
  cardioMinutes: number;
  weightAvgKg: number | null;
  weightDays: number;
  waistAvgCm: number | null;
  waistDays: number;
  waterAvgMl: number | null;
  waterDays: number;
  mealDays: number;
  energyAvgKcal: number | null;
  energyCompleteDays: number;
  proteinAvgG: number | null;
  proteinCompleteDays: number;
  sleepAvgMinutes: number | null;
  sleepDays: number;
  topMealContexts: { context: string; count: number }[];
};

export type ReportExportFields = {
  weight: boolean;
  measurements: boolean;
  nutrition: boolean;
  hydration: boolean;
  training: boolean;
  sleep: boolean;
  notes: boolean;
};

export function formatReportMarkdown(
  report: PeriodReportInput,
  review: WeeklyReview | null,
  fields: ReportExportFields,
): string {
  const lines: string[] = [
    `# Resumo de Evolução (${report.startDate} a ${report.endDate})`,
    `Dias com algum registro: ${report.daysWithAnyData}/${report.totalDays}`,
  ];
  if (fields.weight) {
    lines.push(
      `Peso médio: ${report.weightAvgKg !== null ? `${report.weightAvgKg.toLocaleString('pt-BR')} kg (${report.weightDays} dia(s))` : 'Não registrado'}`,
    );
  }
  if (fields.measurements) {
    lines.push(
      `Cintura média: ${report.waistAvgCm !== null ? `${report.waistAvgCm.toLocaleString('pt-BR')} cm (${report.waistDays} dia(s))` : 'Não registrado'}`,
    );
  }
  if (fields.training) {
    lines.push(
      `Treinos concluídos: ${report.completedWorkouts} (planejados: ${report.plannedWorkouts}) · Cardio: ${report.cardioMinutes} min`,
    );
  }
  if (fields.hydration) {
    lines.push(
      `Água média (nos dias registrados): ${report.waterAvgMl !== null ? `${report.waterAvgMl.toLocaleString('pt-BR')} mL (${report.waterDays} dia(s))` : 'Não registrado'}`,
    );
  }
  if (fields.nutrition) {
    lines.push(`Dias com refeições registradas: ${report.mealDays}/${report.totalDays}`);
    if (report.energyAvgKcal !== null) {
      lines.push(
        `Energia média (dias completos): ${report.energyAvgKcal.toLocaleString('pt-BR')} kcal (${report.energyCompleteDays} dia(s))`,
      );
    }
    if (report.proteinAvgG !== null) {
      lines.push(
        `Proteína média (dias completos): ${report.proteinAvgG.toLocaleString('pt-BR')} g (${report.proteinCompleteDays} dia(s))`,
      );
    }
    if (report.topMealContexts.length > 0) {
      lines.push(
        `Contextos alimentares relatados: ${report.topMealContexts.map((c) => `${c.context} (${c.count})`).join(', ')}`,
      );
    }
  }
  if (fields.sleep) {
    lines.push(
      `Sono médio: ${report.sleepAvgMinutes !== null ? `${formatMinutesAsHours(report.sleepAvgMinutes)} (${report.sleepDays} dia(s))` : 'Não registrado'}`,
    );
  }
  if (fields.notes && review) {
    if (review.whatWorked) lines.push(`O que funcionou: ${review.whatWorked}`);
    if (review.difficulties) lines.push(`Dificuldades: ${review.difficulties}`);
    if (review.energyNote) lines.push(`Disposição: ${review.energyNote}`);
    if (review.hungerNote) lines.push(`Fome: ${review.hungerNote}`);
    if (review.adjustments) lines.push(`Ajustes desejados: ${review.adjustments}`);
  }
  return lines.join('\n');
}
