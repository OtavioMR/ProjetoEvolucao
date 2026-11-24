import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { migrateDatabase } from '../core/database/migrate.ts';
import { ProfileRepository } from '../core/database/repositories/profile-repository.ts';
import { syntheticSetup } from './fixtures.ts';
import { connect } from './sqlite-test-connection.ts';

test('migra banco vazio e reexecuta sem alterar perfil nem criar eventos', async () => {
  const { db, native, repo } = connect();
  try {
    await migrateDatabase(db);
    assert.equal(await repo.read(), null);
    await repo.create(syntheticSetup());
    const before = await repo.read();
    await migrateDatabase(db);
    assert.deepEqual(await repo.read(), before);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    assert.deepEqual(
      tables.map((t) => t.name),
      [
        'food_portions',
        'foods',
        'goal_versions',
        'meal_items',
        'meal_template_items',
        'meal_templates',
        'meals',
        'preferences',
        'profile',
        'recipe_items',
        'recipes',
        'schema_migrations',
        'water_entries',
      ],
    );
    assert.equal(before?.goals[0]?.effectiveFromDate, '2026-04-07');
    assert.equal(
      (await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys,
      1,
    );
  } finally {
    native.close();
  }
});

test('persistência real em arquivo após fechar/reabrir e editar visibilidade', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'evolucao-test-'));
  const file = join(folder, 'test.db');
  let connection = connect(file);
  try {
    await migrateDatabase(connection.db);
    await connection.repo.create(syntheticSetup());
    const before = (await connection.repo.read())!;
    connection.native.close();
    connection = connect(file);
    await migrateDatabase(connection.db);
    assert.deepEqual(await connection.repo.read(), before);
    await connection.repo.updatePreferences(before.profile.id, {
      ...before.preferences,
      theme: 'light',
      visibility: { ...before.preferences.visibility, sleep: false },
    });
    const after = (await connection.repo.read())!;
    assert.equal(after.preferences.theme, 'light');
    assert.equal(after.preferences.visibility.sleep, false);
    assert.deepEqual(after.goals, before.goals);
    assert.deepEqual(after.profile, before.profile);
  } finally {
    connection.native.close();
    const resolved = resolve(folder);
    if (dirname(resolved) !== resolve(tmpdir()) || !basename(resolved).startsWith('evolucao-test-'))
      throw new Error('unsafe_test_cleanup');
    rmSync(resolved, { recursive: true, force: true });
  }
});

test('falha no agregado faz rollback de perfil, preferências e metas', async () => {
  const { db, native, queue } = connect();
  try {
    await migrateDatabase(db);
    const sameId = randomUUID();
    const repo = new ProfileRepository(queue, () => sameId);
    await assert.rejects(repo.create(syntheticSetup()), /UNIQUE/);
    assert.equal(await repo.read(), null);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM preferences'))?.n,
      0,
    );
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM goal_versions'))?.n,
      0,
    );
  } finally {
    native.close();
  }
});

test('duas submissões concorrentes mantêm um único perfil sem sobrescrever dados', async () => {
  const { db, native, repo } = connect();
  try {
    await migrateDatabase(db);
    const results = await Promise.allSettled([
      repo.create(syntheticSetup()),
      repo.create(syntheticSetup()),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM profile'))?.n, 1);
    assert.equal((await repo.read())?.goals.length, 2);
  } finally {
    native.close();
  }
});

test('chaves estrangeiras e intervalos de metas protegidos em insert e update', async () => {
  const { db, native, repo } = connect();
  try {
    await migrateDatabase(db);
    const insert = (id: string, profile: string, from: string, to: string | null) =>
      db.runAsync(
        'INSERT INTO goal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        profile,
        'water',
        2000,
        'mL',
        from,
        to,
        1,
        '2026-04-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
      );
    await assert.rejects(insert(randomUUID(), randomUUID(), '2026-04-01', null), /FOREIGN KEY/);
    await repo.create(syntheticSetup());
    const snapshot = (await repo.read())!;
    await assert.rejects(
      insert(randomUUID(), snapshot.profile.id, '2026-04-08', null),
      /goal_overlap/,
    );
    const water = snapshot.goals.find((g) => g.metric === 'water')!;
    await db.runAsync(
      'UPDATE goal_versions SET effective_to_date = ? WHERE id = ?',
      '2026-04-07',
      water.id,
    );
    const nextId = randomUUID();
    await insert(nextId, snapshot.profile.id, '2026-04-08', null);
    await assert.rejects(
      db.runAsync(
        'UPDATE goal_versions SET effective_from_date = ? WHERE id = ?',
        '2026-04-07',
        nextId,
      ),
      /goal_overlap/,
    );
    await assert.rejects(
      insert(randomUUID(), snapshot.profile.id, '2026-02-30', '2026-02-30'),
      /CHECK/,
    );
  } finally {
    native.close();
  }
});

test('versão futura recusa inicialização sem alterar dados existentes', async () => {
  const { db, native, repo } = connect();
  try {
    await migrateDatabase(db);
    await repo.create(syntheticSetup());
    const before = await repo.read();
    await db.runAsync('INSERT INTO schema_migrations VALUES (?, ?)', 3, '2026-04-01T00:00:00Z');
    await assert.rejects(migrateDatabase(db), /unsupported_schema_version/);
    assert.deepEqual(await repo.read(), before);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM schema_migrations'))?.n,
      3,
    );
  } finally {
    native.close();
  }
});

test('migração com falha não deixa DDL nem versão parcialmente aplicados', async () => {
  const { db, native } = connect();
  try {
    await db.execAsync('CREATE TABLE preferences (existing TEXT)');
    await assert.rejects(migrateDatabase(db), /already exists/);
    const row = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'profile'");
    assert.equal(row, null);
    assert.equal(
      await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'"),
      null,
    );
    assert.ok(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'preferences'"));
  } finally {
    native.close();
  }
});

test('parâmetros com SQL viram texto e atualização inválida preserva base', async () => {
  const { db, native, repo } = connect();
  try {
    await migrateDatabase(db);
    const input = syntheticSetup();
    input.profile.displayName = "Teste'); DROP TABLE profile; --";
    await repo.create(input);
    const before = (await repo.read())!;
    assert.equal(before.profile.displayName, input.profile.displayName);
    await assert.rejects(
      repo.updateProfile(before.profile.id, { ...input.profile, heightCm: Infinity }),
    );
    assert.deepEqual(await repo.read(), before);
  } finally {
    native.close();
  }
});

test('fila impede leituras externas durante transação e continua após falha', async () => {
  const { db, native, queue } = connect();
  try {
    await migrateDatabase(db);
    const events: string[] = [];
    const transaction = queue.transaction(async () => {
      events.push('begin');
      await Promise.resolve();
      events.push('end');
      throw new Error('intentional');
    });
    const read = queue.run(async () => {
      events.push('read');
      return 42;
    });
    await assert.rejects(transaction, /intentional/);
    assert.equal(await read, 42);
    assert.deepEqual(events, ['begin', 'end', 'read']);
  } finally {
    native.close();
  }
});
