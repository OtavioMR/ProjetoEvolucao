import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { migrateDatabase, migrations } from '../core/database/migrate.ts';
import { DiaryRepository } from '../core/database/repositories/diary-repository.ts';
import { BackupRepository } from '../core/database/repositories/backup-repository.ts';
import { eventInstant } from '../core/date-time/event-time.ts';
import { parseBackup, validateBackup } from '../domain/backup/backup.ts';
import {
  descriptiveItem,
  resizeItem,
  snapshotFood,
  snapshotRecipe,
  summarize,
  type Food,
  type Meal,
  type WaterEntry,
} from '../domain/nutrition/nutrition.ts';
import { syntheticSetup } from './fixtures.ts';
import { connect } from './sqlite-test-connection.ts';

export function testFood(): Food {
  return {
    id: randomUUID(),
    name: 'Alimento sintético',
    preparation: 'Cozido',
    brand: '',
    referenceQuantity: 100,
    referenceUnit: 'g',
    nutrients: { kcal: 130, protein: 3, carbs: null, fat: 0, fiber: null },
    source: 'Rótulo sintético de teste',
    sourceVersion: '',
    portions: [],
    favorite: false,
    archived: false,
  };
}
function testMeal(food: Food): Meal {
  return {
    id: randomUUID(),
    localDate: '2026-04-07',
    occurredAt: '2026-04-08T02:50:00.000Z',
    timezone: 'America/Sao_Paulo',
    title: 'Refeição sintética',
    mealType: 'Teste',
    hunger: 0,
    satiety: null,
    context: '',
    notes: '',
    items: [snapshotFood(food, randomUUID(), 150, 'g')],
  };
}
async function initialized() {
  const c = connect();
  await migrateDatabase(c.db);
  await c.repo.create(syntheticSetup());
  const profileId = (await c.repo.read())!.profile.id;
  return {
    ...c,
    profileId,
    diary: new DiaryRepository(c.queue),
    backup: new BackupRepository(c.queue),
  };
}

test('upgrade 1→2 preserva perfil e metas e não cria consumo; reexecutar é idempotente', async () => {
  const c = connect();
  try {
    await c.db.execAsync(
      'PRAGMA foreign_keys = ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    await c.db.execAsync(migrations[0]!.sql);
    await c.db.runAsync('INSERT INTO schema_migrations VALUES (?, ?)', 1, new Date().toISOString());
    await c.repo.create(syntheticSetup());
    const before = await c.repo.read();
    await migrateDatabase(c.db);
    await migrateDatabase(c.db);
    assert.deepEqual(await c.repo.read(), before);
    assert.deepEqual(await new DiaryRepository(c.queue).day(before!.profile.id, '2026-04-07'), {
      meals: [],
      water: [],
    });
    assert.equal(
      (await c.db.getAllAsync('SELECT * FROM schema_migrations')).length,
      migrations.length,
    );
  } finally {
    c.native.close();
  }
});

test('falha na migração 002 reverte DDL e versão sem tocar na fundação', async () => {
  const c = connect();
  try {
    await c.db.execAsync(
      'PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    await c.db.execAsync(migrations[0]!.sql);
    await c.db.runAsync('INSERT INTO schema_migrations VALUES (?, ?)', 1, new Date().toISOString());
    await c.repo.create(syntheticSetup());
    const before = await c.repo.read();
    await c.db.execAsync('CREATE TABLE recipes(existing TEXT)');
    await assert.rejects(migrateDatabase(c.db));
    assert.deepEqual(await c.repo.read(), before);
    assert.equal(
      await c.db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='foods'"),
      null,
    );
    assert.equal((await c.db.getAllAsync('SELECT * FROM schema_migrations')).length, 1);
  } finally {
    c.native.close();
  }
});

test('150 g = 195 kcal; editar catálogo e arquivar preserva snapshot; editar porção usa snapshot', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    const meal = testMeal(f);
    await c.diary.saveMeal(c.profileId, meal);
    await c.diary.saveFood(c.profileId, {
      ...f,
      archived: true,
      nutrients: { ...f.nutrients, kcal: 999 },
    });
    let stored = (await c.diary.day(c.profileId, meal.localDate)).meals[0]!;
    assert.equal(stored.items[0]!.nutrients.kcal, 195);
    assert.equal(stored.items[0]!.nutrients.fat, 0);
    stored = { ...stored, items: [resizeItem(stored.items[0]!, 200)] };
    await c.diary.saveMeal(c.profileId, stored);
    assert.equal(
      (await c.diary.day(c.profileId, meal.localDate)).meals[0]!.items[0]!.nutrients.kcal,
      260,
    );
    const unknown = descriptiveItem(randomUUID(), 'Sem rótulo', 'Um prato');
    assert.equal(summarize([meal.items[0]!, unknown]).nutrients.kcal, 195);
    assert.equal(summarize([meal.items[0]!, unknown]).complete.kcal, false);
    assert.equal(summarize([unknown]).nutrients.kcal, null);
  } finally {
    c.native.close();
  }
});

test('cópia possui IDs próprios e data corrigida; editar/excluir cópia preserva original', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    const original = testMeal(f);
    await c.diary.saveMeal(c.profileId, original);
    const copy: Meal = {
      ...original,
      id: randomUUID(),
      localDate: '2026-04-09',
      occurredAt: eventInstant('2026-04-09', '12:00', original.timezone),
      items: original.items.map((i) => ({ ...resizeItem(i, 300), id: randomUUID() })),
    };
    await c.diary.saveMeal(c.profileId, copy);
    assert.equal(
      (await c.diary.day(c.profileId, copy.localDate)).meals[0]!.items[0]!.nutrients.kcal,
      390,
    );
    await c.diary.deleteMeal(c.profileId, copy.id);
    assert.deepEqual((await c.diary.day(c.profileId, original.localDate)).meals[0], original);
    assert.equal((await c.db.getAllAsync('SELECT * FROM meal_items')).length, 1);
  } finally {
    c.native.close();
  }
});

test('submit com mesmo UUID é idempotente e falha no filho reverte edição inteira', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    const meal = testMeal(f);
    await Promise.all([c.diary.saveMeal(c.profileId, meal), c.diary.saveMeal(c.profileId, meal)]);
    assert.equal((await c.diary.day(c.profileId, meal.localDate)).meals.length, 1);
    await assert.rejects(
      c.diary.saveMeal(c.profileId, {
        ...meal,
        title: 'Não deve persistir',
        items: [{ ...meal.items[0]!, foodId: randomUUID() }],
      }),
    );
    assert.deepEqual((await c.diary.day(c.profileId, meal.localDate)).meals[0], meal);
  } finally {
    c.native.close();
  }
});

test('água 250+500+300 = 1.050; outra bebida não entra; desfazer remove somente ID correto', async () => {
  const c = await initialized();
  try {
    const water: WaterEntry[] = [250, 500, 300, 400].map((amountMl, i) => ({
      id: randomUUID(),
      localDate: '2026-04-07',
      occurredAt: '2026-04-08T02:50:00.000Z',
      timezone: 'America/Sao_Paulo',
      amountMl,
      beverage: i === 3 ? 'other' : 'water',
      notes: '',
    }));
    for (const w of water) await c.diary.saveWater(c.profileId, w);
    await c.diary.saveWater(c.profileId, water[0]!);
    const total = async () =>
      (await c.diary.day(c.profileId, '2026-04-07')).water
        .filter((w) => w.beverage === 'water')
        .reduce((n, w) => n + w.amountMl, 0);
    assert.equal(await total(), 1050);
    await c.diary.deleteWater(c.profileId, water[1]!.id);
    assert.equal(await total(), 550);
    const edited = {
      ...water[2]!,
      localDate: '2026-04-09',
      occurredAt: eventInstant('2026-04-09', '12:00', water[2]!.timezone),
      amountMl: 600,
    };
    await c.diary.saveWater(c.profileId, edited);
    assert.equal(await total(), 250);
    assert.equal((await c.diary.day(c.profileId, '2026-04-09')).water[0]!.amountMl, 600);
    await assert.rejects(c.diary.saveWater(c.profileId, { ...edited, amountMl: Infinity }));
  } finally {
    c.native.close();
  }
});

test('23h50 permanece no dia histórico após alterar o fuso e ocultar indicadores', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    const meal = testMeal(f);
    await c.diary.saveMeal(c.profileId, meal);
    const p = (await c.repo.read())!;
    await c.repo.updateProfile(p.profile.id, { ...p.profile, timezone: 'Asia/Tokyo' });
    await c.repo.updatePreferences(p.profile.id, {
      ...p.preferences,
      visibility: { ...p.preferences.visibility, calories: false, macros: false },
    });
    assert.deepEqual((await c.diary.day(c.profileId, '2026-04-07')).meals[0], meal);
    assert.equal((await c.diary.day(c.profileId, '2026-04-08')).meals.length, 0);
    await assert.rejects(c.diary.saveMeal(c.profileId, { ...meal, localDate: '2026-04-08' }));
  } finally {
    c.native.close();
  }
});

test('receita usa rendimento final e mantém estimativa parcial; modelo nunca cria consumo', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    const recipe = {
      id: randomUUID(),
      name: 'Receita sintética',
      yieldQuantity: 500,
      yieldUnit: 'g' as const,
      notes: '',
      archived: false,
      items: [
        snapshotFood(f, randomUUID(), 200, 'g'),
        descriptiveItem(randomUUID(), 'Ingrediente desconhecido', 'Uma colher'),
      ],
    };
    await c.diary.saveRecipe(c.profileId, recipe);
    const item = snapshotRecipe(recipe, randomUUID(), 250, 'g');
    assert.equal(item.nutrients.kcal, 130);
    assert.equal(item.complete.kcal, false);
    await c.diary.saveTemplate(c.profileId, {
      id: randomUUID(),
      name: 'Modelo sintético',
      items: [item],
    });
    assert.equal((await c.diary.catalog(c.profileId)).templates.length, 1);
    assert.equal((await c.diary.day(c.profileId, '2026-04-07')).meals.length, 0);
    await c.diary.saveMeal(c.profileId, { ...testMeal(f), items: [{ ...item, id: randomUUID() }] });
    const backup = await c.backup.export();
    const target = connect();
    try {
      await migrateDatabase(target.db);
      await new BackupRepository(target.queue).restore(parseBackup(JSON.stringify(backup)));
      assert.deepEqual((await new BackupRepository(target.queue).export()).tables, backup.tables);
    } finally {
      target.native.close();
    }
  } finally {
    c.native.close();
  }
});

test('backup inclui todos os módulos e recusa versões, colunas, IDs e relações inválidos sem alterar base', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    f.portions = [
      {
        id: randomUUID(),
        label: 'Colher sintética',
        quantity: 1,
        unit: 'portion',
        baseQuantity: 20,
        baseUnit: 'g',
      },
    ];
    await c.diary.saveFood(c.profileId, f);
    await c.diary.saveMeal(c.profileId, testMeal(f));
    const backup = await c.backup.export();
    for (const mutate of [
      (v: typeof backup) => {
        v.schemaVersion = 99 as typeof v.schemaVersion;
      },
      (v: typeof backup) => {
        v.tables.meals[0]!.extra = 'injetado';
      },
      (v: typeof backup) => {
        v.tables.meal_items[0]!.food_id = randomUUID();
      },
      (v: typeof backup) => {
        v.tables.meals.push(v.tables.meals[0]!);
      },
      (v: typeof backup) => {
        v.tables.foods[0]!.profile_id = randomUUID();
      },
      (v: typeof backup) => {
        v.tables.preferences[0]!.theme = 'inválido';
      },
    ]) {
      const invalid = structuredClone(backup);
      mutate(invalid);
      assert.throws(() => validateBackup(invalid));
      await assert.rejects(c.backup.restore(invalid));
      assert.deepEqual((await c.backup.export()).tables, backup.tables);
    }
    assert.throws(() => parseBackup('{inválido'));
  } finally {
    c.native.close();
  }
});

test('erro durante restauração faz rollback inclusive da remoção dos dados antigos', async () => {
  const c = await initialized();
  try {
    const f = testFood();
    await c.diary.saveFood(c.profileId, f);
    await c.diary.saveMeal(c.profileId, testMeal(f));
    const before = await c.backup.export();
    const incoming = structuredClone(before);
    incoming.tables.profile[0]!.display_name = 'Importação de teste';
    await c.db.execAsync(
      "CREATE TRIGGER fail_restore BEFORE INSERT ON foods BEGIN SELECT RAISE(ABORT, 'test_restore_failure'); END",
    );
    await assert.rejects(c.backup.restore(incoming), /test_restore_failure/);
    assert.deepEqual((await c.backup.export()).tables, before.tables);
  } finally {
    c.native.close();
  }
});

test('lote de catálogo reverte todos os alimentos quando uma porção conflita', async () => {
  const c = await initialized();
  try {
    const portion = {
      id: randomUUID(),
      label: 'Porção de teste',
      quantity: 1,
      unit: 'portion' as const,
      baseQuantity: 20,
      baseUnit: 'g' as const,
    };
    const first = { ...testFood(), portions: [portion] };
    const second = { ...testFood(), portions: [portion] };
    await assert.rejects(c.diary.saveFoods(c.profileId, [first, second]), /UNIQUE/);
    assert.equal((await c.diary.catalog(c.profileId)).foods.length, 0);
    await c.diary.saveFoods(c.profileId, [first]);
    await c.diary.saveFoods(c.profileId, [first]);
    assert.equal((await c.diary.catalog(c.profileId)).foods.length, 1);
  } finally {
    c.native.close();
  }
});
