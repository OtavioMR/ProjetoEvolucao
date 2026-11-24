import { z } from 'zod';
import { DatabaseQueue, type SqlConnection } from '../connection.ts';
import {
  foodSchema,
  mealSchema,
  recipeSchema,
  templateSchema,
  waterSchema,
  type Food,
  type Meal,
  type MealItem,
  type MealTemplate,
  type Recipe,
  type WaterEntry,
} from '../../../domain/nutrition/nutrition.ts';
import { isLocalDate } from '../../date-time/local-date.ts';

export type Catalog = {
  foods: Food[];
  recipes: Recipe[];
  templates: MealTemplate[];
  recentFoodIds: string[];
};
type CatalogTable = 'foods' | 'recipes' | 'meal_templates';
type ItemTable = 'recipe_items' | 'meal_template_items' | 'meal_items';
type DocumentRow = { id: string; data: string };
export type WaterRow = {
  id: string;
  local_date: string;
  occurred_at: string;
  timezone_at_entry: string;
  amount_ml: number;
  beverage_type: string;
  notes: string;
};

export class DiaryRepository {
  private readonly queue: DatabaseQueue;
  private readonly now: () => Date;
  constructor(queue: DatabaseQueue, now: () => Date = () => new Date()) {
    this.queue = queue;
    this.now = now;
  }

  catalog(profileId: string): Promise<Catalog> {
    return this.queue.run(async (db) => {
      const foods: Food[] = [];
      for (const row of await db.getAllAsync<DocumentRow>(
        'SELECT id, data FROM foods WHERE profile_id = ? ORDER BY created_at, id',
        profileId,
      )) {
        const portions = await db.getAllAsync<DocumentRow>(
          'SELECT id, data FROM food_portions WHERE food_id = ? ORDER BY rowid',
          row.id,
        );
        foods.push(
          foodSchema.parse({
            ...JSON.parse(row.data),
            portions: portions.map((p) => JSON.parse(p.data)),
          }),
        );
      }
      const recipes = await this.readCatalog(
        db,
        'recipes',
        'recipe_items',
        profileId,
        recipeSchema,
      );
      const templates = await this.readCatalog(
        db,
        'meal_templates',
        'meal_template_items',
        profileId,
        templateSchema,
      );
      const recent = await db.getAllAsync<{ food_id: string }>(
        'SELECT i.food_id FROM meal_items i JOIN meals m ON m.id = i.parent_id WHERE m.profile_id = ? AND i.food_id IS NOT NULL GROUP BY i.food_id ORDER BY max(m.occurred_at) DESC LIMIT 20',
        profileId,
      );
      return { foods, recipes, templates, recentFoodIds: recent.map((r) => r.food_id) };
    });
  }

  day(profileId: string, date: string): Promise<{ meals: Meal[]; water: WaterEntry[] }> {
    if (!isLocalDate(date)) return Promise.reject(new Error('Data inválida.'));
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<DocumentRow>(
        'SELECT id, data FROM meals WHERE profile_id = ? AND local_date = ? ORDER BY occurred_at, id',
        profileId,
        date,
      );
      const meals: Meal[] = [];
      for (const row of rows)
        meals.push(
          mealSchema.parse({
            ...JSON.parse(row.data),
            items: await this.readItems(db, 'meal_items', row.id),
          }),
        );
      const water = (
        await db.getAllAsync<WaterRow>(
          'SELECT * FROM water_entries WHERE profile_id = ? AND local_date = ? ORDER BY occurred_at, id',
          profileId,
          date,
        )
      ).map(waterFromRow);
      return { meals, water };
    });
  }

  async saveFood(profileId: string, input: Food): Promise<void> {
    return this.saveFoods(profileId, [input]);
  }

  async saveFoods(profileId: string, input: Food[]): Promise<void> {
    const foods = input.map((food) => foodSchema.parse(food));
    return this.queue.transaction(async (db) => {
      for (const food of foods) {
        const { portions, ...header } = food;
        await this.saveDocument(db, 'foods', profileId, food.id, header);
        await db.runAsync('DELETE FROM food_portions WHERE food_id = ?', food.id);
        for (const p of portions)
          await db.runAsync(
            'INSERT INTO food_portions(id, food_id, data) VALUES (?, ?, ?)',
            p.id,
            food.id,
            JSON.stringify(p),
          );
      }
    });
  }

  async saveTemplates(profileId: string, input: MealTemplate[]): Promise<void> {
    const templates = input.map((template) => templateSchema.parse(template));
    return this.queue.transaction(async (db) => {
      for (const template of templates) {
        const { items, ...header } = template;
        await this.saveDocument(db, 'meal_templates', profileId, template.id, header);
        await this.replaceItems(db, 'meal_template_items', profileId, template.id, items);
      }
    });
  }

  async saveRecipe(profileId: string, input: Recipe): Promise<void> {
    const recipe = recipeSchema.parse(input);
    if (recipe.items.some((i) => i.recipeId))
      return Promise.reject(new Error('Use alimentos como ingredientes da receita.'));
    return this.saveAggregate('recipes', 'recipe_items', profileId, recipe);
  }

  async saveTemplate(profileId: string, input: MealTemplate): Promise<void> {
    return this.saveAggregate(
      'meal_templates',
      'meal_template_items',
      profileId,
      templateSchema.parse(input),
    );
  }

  async saveMeal(profileId: string, input: Meal): Promise<void> {
    const meal = mealSchema.parse(input);
    const { items, ...header } = meal;
    return this.queue.transaction(async (db) => {
      await this.assertOwner(db, 'meals', profileId, meal.id);
      const stamp = this.now().toISOString();
      await db.runAsync(
        'INSERT INTO meals(id, profile_id, local_date, occurred_at, timezone_at_entry, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET local_date=excluded.local_date, occurred_at=excluded.occurred_at, timezone_at_entry=excluded.timezone_at_entry, data=excluded.data, updated_at=excluded.updated_at',
        meal.id,
        profileId,
        meal.localDate,
        meal.occurredAt,
        meal.timezone,
        JSON.stringify(header),
        stamp,
        stamp,
      );
      await this.replaceItems(db, 'meal_items', profileId, meal.id, items);
    });
  }

  async saveWater(profileId: string, input: WaterEntry): Promise<void> {
    const w = waterSchema.parse(input);
    return this.queue.transaction(async (db) => {
      await this.assertOwner(db, 'water_entries', profileId, w.id);
      const stamp = this.now().toISOString();
      await db.runAsync(
        'INSERT INTO water_entries(id, profile_id, local_date, occurred_at, timezone_at_entry, amount_ml, beverage_type, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET local_date=excluded.local_date, occurred_at=excluded.occurred_at, timezone_at_entry=excluded.timezone_at_entry, amount_ml=excluded.amount_ml, beverage_type=excluded.beverage_type, notes=excluded.notes, updated_at=excluded.updated_at',
        w.id,
        profileId,
        w.localDate,
        w.occurredAt,
        w.timezone,
        w.amountMl,
        w.beverage,
        w.notes,
        stamp,
        stamp,
      );
    });
  }

  deleteMeal(profileId: string, id: string): Promise<void> {
    return this.remove('meals', profileId, id);
  }
  deleteWater(profileId: string, id: string): Promise<void> {
    return this.remove('water_entries', profileId, id);
  }
  deleteTemplate(profileId: string, id: string): Promise<void> {
    return this.remove('meal_templates', profileId, id);
  }

  private remove(
    table: 'meals' | 'water_entries' | 'meal_templates',
    profileId: string,
    id: string,
  ): Promise<void> {
    return this.queue.transaction(async (db) => {
      await db.runAsync(`DELETE FROM ${table} WHERE id = ? AND profile_id = ?`, id, profileId);
    });
  }
  private async assertOwner(
    db: SqlConnection,
    table: CatalogTable | 'meals' | 'water_entries',
    profileId: string,
    id: string,
  ) {
    const existing = await db.getFirstAsync<{ profile_id: string }>(
      `SELECT profile_id FROM ${table} WHERE id = ?`,
      id,
    );
    if (existing && existing.profile_id !== profileId) throw new Error('Registro de outro perfil.');
  }
  private async saveDocument(
    db: SqlConnection,
    table: CatalogTable,
    profileId: string,
    id: string,
    data: unknown,
  ) {
    await this.assertOwner(db, table, profileId, id);
    const stamp = this.now().toISOString();
    await db.runAsync(
      `INSERT INTO ${table}(id, profile_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      id,
      profileId,
      JSON.stringify(data),
      stamp,
      stamp,
    );
  }
  private saveAggregate(
    table: 'recipes' | 'meal_templates',
    children: ItemTable,
    profileId: string,
    value: Recipe | MealTemplate,
  ) {
    const { items, ...header } = value;
    return this.queue.transaction(async (db) => {
      await this.saveDocument(db, table, profileId, value.id, header);
      await this.replaceItems(db, children, profileId, value.id, items);
    });
  }
  private async replaceItems(
    db: SqlConnection,
    table: ItemTable,
    profileId: string,
    parentId: string,
    items: MealItem[],
  ) {
    await db.runAsync(`DELETE FROM ${table} WHERE parent_id = ?`, parentId);
    for (const [position, item] of items.entries()) {
      if (
        item.foodId &&
        !(await db.getFirstAsync(
          'SELECT id FROM foods WHERE id = ? AND profile_id = ?',
          item.foodId,
          profileId,
        ))
      )
        throw new Error('Alimento não encontrado.');
      if (
        item.recipeId &&
        !(await db.getFirstAsync(
          'SELECT id FROM recipes WHERE id = ? AND profile_id = ?',
          item.recipeId,
          profileId,
        ))
      )
        throw new Error('Receita não encontrada.');
      await db.runAsync(
        `INSERT INTO ${table}(id, parent_id, position, food_id, source_recipe_id, data) VALUES (?, ?, ?, ?, ?, ?)`,
        item.id,
        parentId,
        position,
        item.foodId,
        item.recipeId,
        JSON.stringify(item),
      );
    }
  }
  private async readItems(db: SqlConnection, table: ItemTable, id: string) {
    return (
      await db.getAllAsync<DocumentRow>(
        `SELECT id, data FROM ${table} WHERE parent_id = ? ORDER BY position`,
        id,
      )
    ).map((r) => JSON.parse(r.data));
  }
  private async readCatalog<T>(
    db: SqlConnection,
    table: CatalogTable,
    children: ItemTable,
    profileId: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const values: T[] = [];
    for (const row of await db.getAllAsync<DocumentRow>(
      `SELECT id, data FROM ${table} WHERE profile_id = ? ORDER BY created_at, id`,
      profileId,
    ))
      values.push(
        schema.parse({
          ...JSON.parse(row.data),
          items: await this.readItems(db, children, row.id),
        }),
      );
    return values;
  }
}

export function waterFromRow(w: WaterRow): WaterEntry {
  return waterSchema.parse({
    id: w.id,
    localDate: w.local_date,
    occurredAt: w.occurred_at,
    timezone: w.timezone_at_entry,
    amountMl: w.amount_ml,
    beverage: w.beverage_type,
    notes: w.notes,
  });
}
