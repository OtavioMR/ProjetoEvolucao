import { z } from 'zod';
import { isLocalDate, isTimezone, localDateAt } from '../../core/date-time/local-date.ts';

export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const;
export type Nutrient = (typeof nutrientKeys)[number];
const amount = z.number().finite().nonnegative().nullable();
export const nutrientsSchema = z.object({
  kcal: amount,
  protein: amount,
  carbs: amount,
  fat: amount,
  fiber: amount,
});
export type Nutrients = z.infer<typeof nutrientsSchema>;
export const unknownNutrients = (): Nutrients => ({
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
});
export const completeSchema = z.object({
  kcal: z.boolean(),
  protein: z.boolean(),
  carbs: z.boolean(),
  fat: z.boolean(),
  fiber: z.boolean(),
});
export type Completeness = z.infer<typeof completeSchema>;
export const unitSchema = z.enum(['g', 'mL', 'unit', 'portion']);
export type Unit = z.infer<typeof unitSchema>;
export const unitLabels: Record<Unit, string> = {
  g: 'g',
  mL: 'mL',
  unit: 'unidade',
  portion: 'porção',
};
const text = z.string().trim().min(1).max(160);
const note = z.string().trim().max(2000);
const positive = z.number().finite().positive();
export const portionSchema = z.object({
  id: z.uuid(),
  label: text,
  unit: unitSchema,
  quantity: positive,
  baseQuantity: positive,
  baseUnit: unitSchema,
});
export const foodSchema = z
  .object({
    id: z.uuid(),
    name: text,
    preparation: z.string().trim().max(160),
    brand: z.string().trim().max(160),
    referenceQuantity: positive,
    referenceUnit: unitSchema,
    nutrients: nutrientsSchema,
    source: z.string().trim().max(300),
    sourceVersion: z.string().trim().max(100),
    portions: z.array(portionSchema).max(30),
    favorite: z.boolean(),
    archived: z.boolean(),
  })
  .superRefine((food, ctx) => {
    if (nutrientKeys.some((k) => food.nutrients[k] !== null) && !food.source)
      ctx.addIssue({
        code: 'custom',
        message: 'Informe a fonte dos nutrientes (por exemplo, rótulo confirmado).',
        path: ['source'],
      });
    if (new Set(food.portions.map((p) => p.id)).size !== food.portions.length)
      ctx.addIssue({ code: 'custom', message: 'Porções duplicadas.' });
  });
export type Food = z.infer<typeof foodSchema>;
export const itemSchema = z
  .object({
    id: z.uuid(),
    foodId: z.uuid().nullable(),
    recipeId: z.uuid().nullable(),
    name: text,
    preparation: z.string().max(160),
    quantity: positive.nullable(),
    unit: unitSchema,
    portionId: z.uuid().nullable(),
    description: z.string().max(300),
    referenceQuantity: positive.nullable(),
    referenceUnit: unitSchema.nullable(),
    referenceNutrients: nutrientsSchema,
    nutrients: nutrientsSchema,
    complete: completeSchema,
    source: z.string().max(500),
    notes: note,
  })
  .refine((i) => !(i.foodId && i.recipeId), 'Escolha alimento ou receita.');
export type MealItem = z.infer<typeof itemSchema>;
export const recipeSchema = z.object({
  id: z.uuid(),
  name: text,
  yieldQuantity: positive,
  yieldUnit: z.enum(['g', 'portion']),
  notes: note,
  archived: z.boolean(),
  items: z.array(itemSchema).min(1).max(100),
});
export type Recipe = z.infer<typeof recipeSchema>;
export const templateSchema = z.object({
  id: z.uuid(),
  name: text,
  items: z.array(itemSchema).min(1).max(100),
});
export type MealTemplate = z.infer<typeof templateSchema>;
export const eventSchema = z
  .object({
    localDate: z.string().refine(isLocalDate, 'Data inválida.'),
    occurredAt: z.iso.datetime(),
    timezone: z.string().refine(isTimezone, 'Fuso inválido.'),
  })
  .refine(
    (e) => localDateAt(new Date(e.occurredAt), e.timezone) === e.localDate,
    'Data e horário não correspondem ao fuso.',
  );
export const mealSchema = z
  .object({
    id: z.uuid(),
    ...eventSchema.shape,
    title: text,
    mealType: text,
    hunger: z.number().int().min(0).max(10).nullable(),
    satiety: z.number().int().min(0).max(10).nullable(),
    context: z.enum(['', 'fome', 'tédio', 'rotina', 'social', 'estresse', 'outro']),
    notes: note,
    items: z.array(itemSchema).min(1).max(100),
  })
  .refine(
    (e) => localDateAt(new Date(e.occurredAt), e.timezone) === e.localDate,
    'Data e horário não correspondem ao fuso.',
  );
export type Meal = z.infer<typeof mealSchema>;
export const waterSchema = z
  .object({
    id: z.uuid(),
    ...eventSchema.shape,
    amountMl: z.number().int().positive().max(10000),
    beverage: z.enum(['water', 'other']),
    notes: note,
  })
  .refine(
    (e) => localDateAt(new Date(e.occurredAt), e.timezone) === e.localDate,
    'Data e horário não correspondem ao fuso.',
  );
export type WaterEntry = z.infer<typeof waterSchema>;

export function summarize(items: Pick<MealItem, 'nutrients' | 'complete'>[]) {
  const nutrients = unknownNutrients();
  const complete = {} as Completeness;
  for (const key of nutrientKeys) {
    const values = items.map((i) => i.nutrients[key]).filter((n): n is number => n !== null);
    const total = values.reduce((sum, n) => sum + n, 0);
    if (!Number.isFinite(total)) throw new Error('Quantidade excede o limite de cálculo.');
    nutrients[key] = values.length ? total : null;
    complete[key] =
      items.length > 0 && items.every((i) => i.complete[key] && i.nutrients[key] !== null);
  }
  return { nutrients, complete };
}

export function snapshotFood(
  food: Food,
  id: string,
  quantity: number | null,
  unit: Unit,
  portionId: string | null = null,
): MealItem {
  foodSchema.parse(food);
  let converted = quantity;
  let convertedUnit = unit;
  if (portionId) {
    const portion = food.portions.find((p) => p.id === portionId);
    if (!portion || portion.unit !== unit) throw new Error('Porção incompatível.');
    converted = quantity === null ? null : (quantity * portion.baseQuantity) / portion.quantity;
    convertedUnit = portion.baseUnit;
  }
  const ratio =
    converted !== null && convertedUnit === food.referenceUnit
      ? converted / food.referenceQuantity
      : null;
  const nutrients = unknownNutrients();
  const complete = {} as Completeness;
  for (const key of nutrientKeys) {
    nutrients[key] =
      ratio !== null && food.nutrients[key] !== null ? food.nutrients[key] * ratio : null;
    complete[key] = nutrients[key] !== null;
  }
  return itemSchema.parse({
    id,
    foodId: food.id,
    recipeId: null,
    name: food.name,
    preparation: food.preparation,
    quantity,
    unit,
    portionId,
    description: '',
    referenceQuantity: food.referenceQuantity,
    referenceUnit: food.referenceUnit,
    referenceNutrients: food.nutrients,
    nutrients,
    complete,
    source: [food.source, food.sourceVersion].filter(Boolean).join(' · '),
    notes: '',
  });
}

export function descriptiveItem(id: string, name: string, description: string): MealItem {
  return itemSchema.parse({
    id,
    name,
    description,
    preparation: '',
    quantity: null,
    unit: 'portion',
    foodId: null,
    recipeId: null,
    portionId: null,
    referenceQuantity: null,
    referenceUnit: null,
    referenceNutrients: unknownNutrients(),
    nutrients: unknownNutrients(),
    complete: { kcal: false, protein: false, carbs: false, fat: false, fiber: false },
    source: '',
    notes: '',
  });
}

export function resizeItem(item: MealItem, quantity: number): MealItem {
  if (item.quantity === null) throw new Error('Item descritivo: edite a descrição da porção.');
  const ratio = quantity / item.quantity;
  const nutrients = { ...item.nutrients };
  for (const key of nutrientKeys) if (nutrients[key] !== null) nutrients[key] *= ratio;
  return itemSchema.parse({ ...item, quantity, nutrients });
}

export function snapshotRecipe(recipe: Recipe, id: string, quantity: number, unit: Unit): MealItem {
  recipeSchema.parse(recipe);
  const summary = summarize(recipe.items);
  const ratio = unit === recipe.yieldUnit ? quantity / recipe.yieldQuantity : null;
  const nutrients = unknownNutrients();
  const complete = { ...summary.complete };
  for (const key of nutrientKeys) {
    nutrients[key] =
      ratio !== null && summary.nutrients[key] !== null ? ratio * summary.nutrients[key] : null;
    complete[key] = complete[key] && nutrients[key] !== null;
  }
  return itemSchema.parse({
    id,
    foodId: null,
    recipeId: recipe.id,
    name: recipe.name,
    preparation: 'Receita caseira',
    quantity,
    unit,
    portionId: null,
    description: '',
    referenceQuantity: recipe.yieldQuantity,
    referenceUnit: recipe.yieldUnit,
    referenceNutrients: summary.nutrients,
    nutrients,
    complete,
    source: 'Receita com ingredientes registrados',
    notes: '',
  });
}
