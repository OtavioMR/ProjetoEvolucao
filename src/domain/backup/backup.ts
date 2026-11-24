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
import { goalSchema, goalUnits, preferencesSchema, profileSchema } from '../profile/profile.ts';

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
};
export type BackupTable = keyof typeof tableSchemas;
export const backupTables = Object.keys(tableSchemas) as BackupTable[];
export type BackupRow = Record<string, string | number | null>;
const envelopeSchema = z.strictObject({
  format: z.literal('evolucao-local'),
  formatVersion: z.literal(1),
  schemaVersion: z.literal(2),
  exportedAt: stamp,
  tables: z.record(
    z.string(),
    z.array(z.record(z.string(), z.union([z.string(), numeric, z.null()]))),
  ),
});
export type Backup = z.infer<typeof envelopeSchema> & { tables: Record<BackupTable, BackupRow[]> };

/** Validação acontece antes de qualquer escrita e novamente antes da substituição. */
export function validateBackup(input: unknown): Backup {
  const data = envelopeSchema.parse(input);
  if (
    Object.keys(data.tables).length !== backupTables.length ||
    backupTables.some((t) => !data.tables[t])
  )
    throw new Error('Tabelas do backup incompatíveis.');
  if (Object.values(data.tables).reduce((n, rows) => n + rows.length, 0) > 20000)
    throw new Error('Backup excede 20.000 registros.');
  const tables = data.tables as Record<BackupTable, BackupRow[]>;
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
  return { ...data, tables };
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
