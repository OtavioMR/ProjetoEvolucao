import { z } from 'zod';
import {
  foodSchema,
  mealSchema,
  recipeSchema,
  templateSchema,
  portionSchema,
  itemSchema,
  waterSchema,
} from '../nutrition/nutrition.ts';
import {
  cardioEntrySchema,
  exerciseSchema,
  sessionExerciseSchema,
  templateExerciseSchema,
  trainingDayOverrideSchema,
  trainingPlanVersionSchema,
  workoutSessionSchema,
  workoutSetSchema,
  workoutTemplateSchema,
} from '../training/training.ts';
import {
  bodyMilestoneSchema,
  habitLogSchema,
  habitSchema,
  measurementEntrySchema,
  sleepEntrySchema,
  weeklyReviewSchema,
  weightEntrySchema,
} from '../evolution/evolution.ts';
import { goalSchema, goalUnits, preferencesSchema, profileSchema } from '../profile/profile.ts';
import { reminderSchema } from '../reminders/reminders.ts';

export const backupLimit = 10 * 1024 * 1024;
const id = z.uuid();
const stamp = z.iso.datetime();
const numeric = z.number().finite();
const nullableNumber = numeric.nullable();
const meta = { created_at: stamp, updated_at: stamp };
const document = { id, profile_id: id, data: z.string(), ...meta };
const child = {
  id,
  parent_id: id,
  position: z.number().int().nonnegative(),
  food_id: id.nullable(),
  source_recipe_id: id.nullable(),
  data: z.string(),
};
export const tableSchemas = {
  profile: z.strictObject({
    id,
    singleton: z.literal(1),
    display_name: z.string(),
    age_at_setup: nullableNumber,
    height_cm: nullableNumber,
    reference_weight_kg: nullableNumber,
    target_weight_kg: nullableNumber,
    timezone: z.string(),
    ...meta,
  }),
  preferences: z.strictObject({
    profile_id: id,
    theme: z.string(),
    locale: z.string(),
    feature_visibility: z.string(),
    quick_water_amounts: z.string(),
    meal_preferences: z.string(),
    available_days: z.string(),
    week_start: numeric,
    training_time: z.string(),
    sleep_start: z.string(),
    sleep_end: z.string(),
    reminders_enabled: z.literal(0),
    ...meta,
  }),
  goal_versions: z.strictObject({
    id,
    profile_id: id,
    metric: z.string(),
    target_value: numeric,
    unit: z.string(),
    effective_from_date: z.string(),
    effective_to_date: z.string().nullable(),
    enabled: z.union([z.literal(0), z.literal(1)]),
    ...meta,
  }),
  foods: z.strictObject(document),
  food_portions: z.strictObject({ id, food_id: id, data: z.string() }),
  recipes: z.strictObject(document),
  recipe_items: z.strictObject(child),
  meal_templates: z.strictObject(document),
  meal_template_items: z.strictObject(child),
  meals: z.strictObject({
    ...document,
    local_date: z.string(),
    occurred_at: stamp,
    timezone_at_entry: z.string(),
  }),
  meal_items: z.strictObject(child),
  water_entries: z.strictObject({
    id,
    profile_id: id,
    local_date: z.string(),
    occurred_at: stamp,
    timezone_at_entry: z.string(),
    amount_ml: numeric,
    beverage_type: z.string(),
    notes: z.string().max(2000),
    ...meta,
  }),
  exercises: z.strictObject(document),
  workout_templates: z.strictObject(document),
  workout_template_exercises: z.strictObject({
    id,
    parent_id: id,
    position: z.number().int().nonnegative(),
    exercise_id: id,
    data: z.string(),
  }),
  training_plan_versions: z.strictObject({
    ...document,
    effective_from_date: z.string(),
    effective_to_date: z.string().nullable(),
  }),
  training_day_overrides: z.strictObject({
    id,
    profile_id: id,
    local_date: z.string(),
    template_id: id.nullable(),
    kind: z.enum(['rest', 'swap']),
    notes: z.string().max(1000),
    ...meta,
  }),
  workout_sessions: z.strictObject({
    ...document,
    template_id: id.nullable(),
    local_date: z.string(),
    started_at: stamp,
    completed_at: stamp.nullable(),
    timezone_at_entry: z.string(),
    status: z.enum(['active', 'completed', 'cancelled']),
  }),
  workout_session_exercises: z.strictObject({
    id,
    session_id: id,
    position: z.number().int().nonnegative(),
    exercise_id: id.nullable(),
    data: z.string(),
  }),
  workout_sets: z.strictObject({
    id,
    session_exercise_id: id,
    position: z.number().int().nonnegative(),
    data: z.string(),
  }),
  cardio_entries: z.strictObject({
    ...document,
    session_id: id.nullable(),
    local_date: z.string(),
    occurred_at: stamp,
    timezone_at_entry: z.string(),
    duration_minutes: numeric,
    distance_km: nullableNumber,
  }),
  weight_entries: z.strictObject({
    id,
    profile_id: id,
    local_date: z.string(),
    occurred_at: stamp,
    timezone_at_entry: z.string(),
    weight_kg: numeric,
    notes: z.string().max(1000),
    ...meta,
  }),
  measurement_entries: z.strictObject({
    id,
    profile_id: id,
    local_date: z.string(),
    occurred_at: stamp,
    timezone_at_entry: z.string(),
    metric: z.string(),
    value_cm: numeric,
    notes: z.string().max(1000),
    ...meta,
  }),
  body_milestones: z.strictObject({
    id,
    profile_id: id,
    title: z.string(),
    target_weight_kg: numeric,
    achieved_at: stamp.nullable(),
    notes: z.string().max(1000),
    ...meta,
  }),
  sleep_entries: z.strictObject({
    id,
    profile_id: id,
    start_at: stamp,
    end_at: stamp,
    wake_local_date: z.string(),
    timezone_at_entry: z.string(),
    is_nap: z.union([z.literal(0), z.literal(1)]),
    quality: z.number().int().min(1).max(5).nullable(),
    notes: z.string().max(1000),
    ...meta,
  }),
  habits: z.strictObject({
    ...document,
    archived_at: stamp.nullable(),
  }),
  habit_logs: z.strictObject({
    id,
    profile_id: id,
    habit_id: id,
    local_date: z.string(),
    status: z.enum(['done', 'not_done', 'not_applicable']),
    notes: z.string().max(1000),
    ...meta,
  }),
  weekly_reviews: z.strictObject({
    ...document,
    week_start_date: z.string(),
  }),
  reminders: z.strictObject({
    id,
    profile_id: id,
    category: z.string(),
    enabled: z.union([z.literal(0), z.literal(1)]),
    local_time: z.string(),
    weekdays: z.string(),
    quiet_start: z.string().nullable(),
    quiet_end: z.string().nullable(),
    platform_notification_ids: z.string(),
    ...meta,
  }),
};
export type BackupTable = keyof typeof tableSchemas;
export const backupTables = Object.keys(tableSchemas) as BackupTable[];
const phase2Tables: BackupTable[] = [
  'exercises',
  'workout_templates',
  'workout_template_exercises',
  'training_plan_versions',
  'training_day_overrides',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'cardio_entries',
];
const phase3Tables: BackupTable[] = [
  'weight_entries',
  'measurement_entries',
  'body_milestones',
  'sleep_entries',
  'habits',
  'habit_logs',
  'weekly_reviews',
];
const phase4Tables: BackupTable[] = ['reminders'];
export type BackupRow = Record<string, string | number | null>;
const envelopeSchema = z.strictObject({
  format: z.literal('evolucao-local'),
  formatVersion: z.literal(1),
  schemaVersion: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  exportedAt: stamp,
  tables: z.record(
    z.string(),
    z.array(z.record(z.string(), z.union([z.string(), numeric, z.null()]))),
  ),
});
export type Backup = Omit<z.infer<typeof envelopeSchema>, 'schemaVersion'> & {
  schemaVersion: 5;
  tables: Record<BackupTable, BackupRow[]>;
};

/** Validação acontece antes de qualquer escrita e novamente antes da substituição. */
export function validateBackup(input: unknown): Backup {
  const data = envelopeSchema.parse(input);
  const excludedTables =
    data.schemaVersion === 2
      ? [...phase2Tables, ...phase3Tables, ...phase4Tables]
      : data.schemaVersion === 3
        ? [...phase3Tables, ...phase4Tables]
        : data.schemaVersion === 4
          ? phase4Tables
          : [];
  const requiredTables = backupTables.filter((t) => !excludedTables.includes(t));
  if (
    Object.keys(data.tables).length !== requiredTables.length ||
    requiredTables.some((t) => !data.tables[t])
  )
    throw new Error('Tabelas do backup incompatíveis.');
  const normalizedTables = { ...data.tables } as Record<BackupTable, BackupRow[]>;
  for (const t of excludedTables) normalizedTables[t] = [];
  if (Object.values(normalizedTables).reduce((n, rows) => n + rows.length, 0) > 20000)
    throw new Error('Backup excede 20.000 registros.');
  const tables = normalizedTables;
  for (const table of backupTables) {
    const keys = new Set<string>();
    for (const row of tables[table]) {
      tableSchemas[table].parse(row);
      const key = String(row.id ?? row.profile_id);
      if (keys.has(key)) throw new Error('IDs duplicados.');
      keys.add(key);
    }
  }
  if (tables.profile.length !== 1 || tables.preferences.length !== 1)
    throw new Error('Backup deve conter um perfil e suas preferências.');
  const p = tables.profile[0]!;
  profileSchema.parse({
    displayName: p.display_name,
    ageAtSetup: p.age_at_setup,
    heightCm: p.height_cm,
    referenceWeightKg: p.reference_weight_kg,
    targetWeightKg: p.target_weight_kg,
    timezone: p.timezone,
  });
  const prefs = tables.preferences[0]!;
  preferencesSchema.parse({
    theme: prefs.theme,
    locale: prefs.locale,
    visibility: JSON.parse(String(prefs.feature_visibility)),
    quickWaterAmounts: JSON.parse(String(prefs.quick_water_amounts)),
    meals: JSON.parse(String(prefs.meal_preferences)),
    availableDays: JSON.parse(String(prefs.available_days)),
    weekStart: prefs.week_start,
    trainingTime: prefs.training_time,
    sleepStart: prefs.sleep_start,
    sleepEnd: prefs.sleep_end,
  });
  for (const table of backupTables)
    for (const row of tables[table])
      if ('profile_id' in row && row.profile_id !== p.id)
        throw new Error('Vínculo de perfil inválido.');
  const goals = tables.goal_versions.map((g) =>
    goalSchema.parse({
      id: g.id,
      profileId: g.profile_id,
      metric: g.metric,
      targetValue: g.target_value,
      unit: g.unit,
      effectiveFromDate: g.effective_from_date,
      effectiveToDate: g.effective_to_date,
      enabled: g.enabled === 1,
    }),
  );
  for (const [i, goal] of goals.entries()) {
    if (
      goalUnits[goal.metric] !== goal.unit ||
      (goal.effectiveToDate && goal.effectiveToDate < goal.effectiveFromDate)
    )
      throw new Error('Vigência ou unidade inválida.');
    if (
      goals
        .slice(i + 1)
        .some(
          (g) =>
            g.metric === goal.metric &&
            g.effectiveFromDate <= (goal.effectiveToDate ?? '9999-12-31') &&
            (g.effectiveToDate ?? '9999-12-31') >= goal.effectiveFromDate,
        )
    )
      throw new Error('Metas sobrepostas.');
  }
  const exists = (table: BackupTable, key: unknown) => tables[table].some((r) => r.id === key);
  const children = (
    table: 'recipe_items' | 'meal_template_items' | 'meal_items',
    parent: BackupTable,
  ) => {
    for (const row of tables[table]) {
      const item = itemSchema.parse(JSON.parse(String(row.data)));
      if (
        !exists(parent, row.parent_id) ||
        item.id !== row.id ||
        item.foodId !== row.food_id ||
        item.recipeId !== row.source_recipe_id
      )
        throw new Error('Snapshot ou vínculo inválido.');
      if (row.food_id && !exists('foods', row.food_id)) throw new Error('Alimento ausente.');
      if (row.source_recipe_id && !exists('recipes', row.source_recipe_id))
        throw new Error('Receita ausente.');
      if (table === 'recipe_items' && row.source_recipe_id)
        throw new Error('Receita aninhada não suportada.');
    }
  };
  children('recipe_items', 'recipes');
  children('meal_template_items', 'meal_templates');
  children('meal_items', 'meals');
  const readItems = (table: BackupTable, parentId: unknown) => {
    const rows = tables[table]
      .filter((r) => r.parent_id === parentId)
      .sort((a, b) => Number(a.position) - Number(b.position));
    if (rows.some((r, i) => r.position !== i)) throw new Error('Ordem dos itens inválida.');
    return rows.map((r) => JSON.parse(String(r.data)));
  };
  for (const portion of tables.food_portions) {
    const parsed = portionSchema.parse(JSON.parse(String(portion.data)));
    if (!exists('foods', portion.food_id) || parsed.id !== portion.id)
      throw new Error('Porção inválida.');
  }
  for (const f of tables.foods) {
    const food = foodSchema.parse({
      ...JSON.parse(String(f.data)),
      portions: tables.food_portions
        .filter((r) => r.food_id === f.id)
        .map((r) => JSON.parse(String(r.data))),
    });
    if (food.id !== f.id) throw new Error('ID de alimento inválido.');
  }
  for (const r of tables.recipes) {
    const recipe = recipeSchema.parse({
      ...JSON.parse(String(r.data)),
      items: readItems('recipe_items', r.id),
    });
    if (recipe.id !== r.id) throw new Error('ID de receita inválido.');
  }
  for (const t of tables.meal_templates) {
    const template = templateSchema.parse({
      ...JSON.parse(String(t.data)),
      items: readItems('meal_template_items', t.id),
    });
    if (template.id !== t.id) throw new Error('ID de modelo inválido.');
  }
  for (const m of tables.meals) {
    const meal = mealSchema.parse({
      ...JSON.parse(String(m.data)),
      items: readItems('meal_items', m.id),
    });
    if (
      meal.id !== m.id ||
      meal.localDate !== m.local_date ||
      meal.occurredAt !== m.occurred_at ||
      meal.timezone !== m.timezone_at_entry
    )
      throw new Error('Evento inconsistente.');
  }
  for (const w of tables.water_entries)
    waterSchema.parse({
      id: w.id,
      localDate: w.local_date,
      occurredAt: w.occurred_at,
      timezone: w.timezone_at_entry,
      amountMl: w.amount_ml,
      beverage: w.beverage_type,
      notes: w.notes,
    });
  for (const ex of tables.exercises) {
    const parsed = exerciseSchema.parse(JSON.parse(String(ex.data)));
    if (parsed.id !== ex.id) throw new Error('ID de exercício inválido.');
  }
  for (const wt of tables.workout_templates) {
    const items = readItems('workout_template_exercises', wt.id);
    const parsed = workoutTemplateSchema.parse({
      ...JSON.parse(String(wt.data)),
      exercises: items,
    });
    if (parsed.id !== wt.id) throw new Error('ID de ficha inválido.');
  }
  for (const item of tables.workout_template_exercises) {
    const parsed = templateExerciseSchema.parse(JSON.parse(String(item.data)));
    if (
      !exists('workout_templates', item.parent_id) ||
      !exists('exercises', item.exercise_id) ||
      parsed.id !== item.id ||
      parsed.exerciseId !== item.exercise_id
    )
      throw new Error('Item de ficha inválido.');
  }
  const plans = tables.training_plan_versions.map((pv) => {
    const parsed = trainingPlanVersionSchema.parse({
      ...JSON.parse(String(pv.data)),
      effectiveFromDate: pv.effective_from_date,
      effectiveToDate: pv.effective_to_date,
    });
    if (parsed.id !== pv.id) throw new Error('ID de agenda inválido.');
    if (parsed.effectiveToDate && parsed.effectiveToDate < parsed.effectiveFromDate)
      throw new Error('Vigência de agenda inválida.');
    return parsed;
  });
  for (const [i, plan] of plans.entries()) {
    if (
      plans
        .slice(i + 1)
        .some(
          (other) =>
            other.effectiveFromDate <= (plan.effectiveToDate ?? '9999-12-31') &&
            (other.effectiveToDate ?? '9999-12-31') >= plan.effectiveFromDate,
        )
    )
      throw new Error('Agendas sobrepostas.');
  }
  const overrideDates = new Set<string>();
  for (const ov of tables.training_day_overrides) {
    trainingDayOverrideSchema.parse({
      id: ov.id,
      localDate: ov.local_date,
      kind: ov.kind,
      templateId: ov.template_id,
      notes: ov.notes,
    });
    if (ov.template_id && !exists('workout_templates', ov.template_id))
      throw new Error('Ficha ausente na exceção de agenda.');
    if (overrideDates.has(String(ov.local_date))) throw new Error('Exceção de dia duplicada.');
    overrideDates.add(String(ov.local_date));
  }
  let activeSessions = 0;
  for (const ws of tables.workout_sessions) {
    if (ws.status === 'active') activeSessions += 1;
    if (activeSessions > 1) throw new Error('Mais de uma sessão ativa no backup.');
    if (ws.template_id && !exists('workout_templates', ws.template_id))
      throw new Error('Ficha ausente na sessão.');
    const exRows = tables.workout_session_exercises
      .filter((r) => r.session_id === ws.id)
      .sort((a, b) => Number(a.position) - Number(b.position));
    if (exRows.some((r, i) => r.position !== i)) throw new Error('Ordem de exercícios inválida.');
    const exercises = exRows.map((er) => {
      if (er.exercise_id && !exists('exercises', er.exercise_id))
        throw new Error('Exercício ausente na sessão.');
      const setRows = tables.workout_sets
        .filter((sr) => sr.session_exercise_id === er.id)
        .sort((a, b) => Number(a.position) - Number(b.position));
      if (setRows.some((r, i) => r.position !== i)) throw new Error('Ordem de séries inválida.');
      const sets = setRows.map((sr) => workoutSetSchema.parse(JSON.parse(String(sr.data))));
      return sessionExerciseSchema.parse({
        ...JSON.parse(String(er.data)),
        exerciseId: er.exercise_id,
        sets,
      });
    });
    const parsed = workoutSessionSchema.parse({
      ...JSON.parse(String(ws.data)),
      id: ws.id,
      templateId: ws.template_id,
      localDate: ws.local_date,
      startedAt: ws.started_at,
      completedAt: ws.completed_at,
      timezoneAtEntry: ws.timezone_at_entry,
      status: ws.status,
      exercises,
    });
    if (parsed.id !== ws.id) throw new Error('ID de sessão inválido.');
  }
  for (const ce of tables.cardio_entries) {
    if (ce.session_id && !exists('workout_sessions', ce.session_id))
      throw new Error('Sessão ausente no cardio.');
    const parsed = cardioEntrySchema.parse({
      ...JSON.parse(String(ce.data)),
      id: ce.id,
      sessionId: ce.session_id,
      localDate: ce.local_date,
      occurredAt: ce.occurred_at,
      timezoneAtEntry: ce.timezone_at_entry,
      durationMinutes: ce.duration_minutes,
      distanceKm: ce.distance_km,
    });
    if (parsed.id !== ce.id) throw new Error('ID de cardio inválido.');
  }
  for (const w of tables.weight_entries) {
    weightEntrySchema.parse({
      id: w.id,
      localDate: w.local_date,
      occurredAt: w.occurred_at,
      timezoneAtEntry: w.timezone_at_entry,
      weightKg: w.weight_kg,
      notes: w.notes,
    });
  }
  for (const m of tables.measurement_entries) {
    measurementEntrySchema.parse({
      id: m.id,
      localDate: m.local_date,
      occurredAt: m.occurred_at,
      timezoneAtEntry: m.timezone_at_entry,
      metric: m.metric,
      valueCm: m.value_cm,
      notes: m.notes,
    });
  }
  for (const bm of tables.body_milestones) {
    bodyMilestoneSchema.parse({
      id: bm.id,
      title: bm.title,
      targetWeightKg: bm.target_weight_kg,
      achievedAt: bm.achieved_at,
      notes: bm.notes,
    });
  }
  for (const s of tables.sleep_entries) {
    sleepEntrySchema.parse({
      id: s.id,
      startAt: s.start_at,
      endAt: s.end_at,
      wakeLocalDate: s.wake_local_date,
      timezoneAtEntry: s.timezone_at_entry,
      isNap: s.is_nap === 1,
      quality: s.quality,
      notes: s.notes,
    });
  }
  for (const h of tables.habits) {
    const parsed = habitSchema.parse({
      ...JSON.parse(String(h.data)),
      archivedAt: h.archived_at,
    });
    if (parsed.id !== h.id) throw new Error('ID de hábito inválido.');
  }
  const habitLogKeys = new Set<string>();
  for (const hl of tables.habit_logs) {
    if (!exists('habits', hl.habit_id)) throw new Error('Hábito ausente no registro.');
    const key = `${hl.habit_id}:${hl.local_date}`;
    if (habitLogKeys.has(key)) throw new Error('Registro de hábito duplicado no mesmo dia.');
    habitLogKeys.add(key);
    habitLogSchema.parse({
      id: hl.id,
      habitId: hl.habit_id,
      localDate: hl.local_date,
      status: hl.status,
      notes: hl.notes,
    });
  }
  const reviewWeeks = new Set<string>();
  for (const wr of tables.weekly_reviews) {
    const weekKey = String(wr.week_start_date);
    if (reviewWeeks.has(weekKey)) throw new Error('Revisão semanal duplicada.');
    reviewWeeks.add(weekKey);
    const parsed = weeklyReviewSchema.parse(JSON.parse(String(wr.data)));
    if (parsed.id !== wr.id || parsed.weekStartDate !== wr.week_start_date) {
      throw new Error('Revisão semanal inconsistente.');
    }
  }
  const reminderCategories = new Set<string>();
  for (const rem of tables.reminders) {
    const category = String(rem.category);
    if (reminderCategories.has(category)) throw new Error('Categoria de lembrete duplicada.');
    reminderCategories.add(category);
    const parsed = reminderSchema.parse({
      id: rem.id,
      category: rem.category,
      enabled: rem.enabled === 1,
      localTime: rem.local_time,
      weekdays: JSON.parse(String(rem.weekdays)),
      quietStart: rem.quiet_start,
      quietEnd: rem.quiet_end,
      platformNotificationIds: JSON.parse(String(rem.platform_notification_ids)),
    });
    if (parsed.id !== rem.id) throw new Error('ID de lembrete inválido.');
  }
  return { ...data, schemaVersion: 5, tables };
}

export function parseBackup(text: string): Backup {
  // Limite UTF-8 conservador também na UI antes de ler o arquivo.
  let bytes = 0;
  if (text.length > backupLimit) throw new Error('Arquivo maior que 10 MiB.');
  for (const character of text) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  if (bytes > backupLimit) throw new Error('Arquivo maior que 10 MiB.');
  return validateBackup(JSON.parse(text));
}
