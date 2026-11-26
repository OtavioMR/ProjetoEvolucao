import { DatabaseQueue, type SqlConnection } from '../connection.ts';
import { isLocalDate } from '../../date-time/local-date.ts';
import {
  cardioEntrySchema,
  exerciseSchema,
  sessionExerciseSchema,
  trainingDayOverrideSchema,
  trainingPlanVersionSchema,
  workoutSessionSchema,
  workoutSetSchema,
  workoutTemplateSchema,
  type CardioEntry,
  type Exercise,
  type LoadConvention,
  type RestTimer,
  type SessionExercise,
  type SessionStatus,
  type TrainingDayOverride,
  type TrainingPlanVersion,
  type WorkoutSession,
  type WorkoutSet,
  type WorkoutTemplate,
} from '../../../domain/training/training.ts';

type DocRow = { id: string; data: string };

export type TrainingLibrarySnapshot = {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  planVersions: TrainingPlanVersion[];
  dayOverrides: TrainingDayOverride[];
};

export class TrainingRepository {
  private readonly queue: DatabaseQueue;
  private readonly now: () => Date;

  constructor(queue: DatabaseQueue, now: () => Date = () => new Date()) {
    this.queue = queue;
    this.now = now;
  }

  library(profileId: string, includeArchived = false): Promise<TrainingLibrarySnapshot> {
    return this.queue.run(async (db) => {
      const exerciseRows = await db.getAllAsync<DocRow>(
        'SELECT id, data FROM exercises WHERE profile_id = ? ORDER BY created_at, id',
        profileId,
      );
      const exercises = exerciseRows
        .map((r) => exerciseSchema.parse(JSON.parse(r.data)))
        .filter((e) => includeArchived || !e.archived);

      const templateRows = await db.getAllAsync<DocRow>(
        'SELECT id, data FROM workout_templates WHERE profile_id = ? ORDER BY created_at, id',
        profileId,
      );
      const templates: WorkoutTemplate[] = [];
      for (const row of templateRows) {
        const itemRows = await db.getAllAsync<DocRow>(
          'SELECT id, data FROM workout_template_exercises WHERE parent_id = ? ORDER BY position',
          row.id,
        );
        const parsed = workoutTemplateSchema.parse({
          ...JSON.parse(row.data),
          exercises: itemRows.map((ir) => JSON.parse(ir.data)),
        });
        if (includeArchived || !parsed.archived) templates.push(parsed);
      }

      const planRows = await db.getAllAsync<{
        id: string;
        effective_from_date: string;
        effective_to_date: string | null;
        data: string;
      }>(
        'SELECT id, effective_from_date, effective_to_date, data FROM training_plan_versions WHERE profile_id = ? ORDER BY effective_from_date DESC, id',
        profileId,
      );
      const planVersions = planRows.map((r) =>
        trainingPlanVersionSchema.parse({
          ...JSON.parse(r.data),
          effectiveFromDate: r.effective_from_date,
          effectiveToDate: r.effective_to_date,
        }),
      );

      const overrideRows = await db.getAllAsync<{
        id: string;
        local_date: string;
        template_id: string | null;
        kind: 'rest' | 'swap';
        notes: string;
      }>(
        'SELECT id, local_date, template_id, kind, notes FROM training_day_overrides WHERE profile_id = ? ORDER BY local_date DESC',
        profileId,
      );
      const dayOverrides = overrideRows.map((r) =>
        trainingDayOverrideSchema.parse({
          id: r.id,
          localDate: r.local_date,
          kind: r.kind,
          templateId: r.template_id,
          notes: r.notes,
        }),
      );

      return { exercises, templates, planVersions, dayOverrides };
    });
  }

  async saveExercise(profileId: string, input: Exercise): Promise<void> {
    const exercise = exerciseSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await this.upsertExercise(db, profileId, exercise, stamp);
    });
  }

  async setExerciseArchived(
    profileId: string,
    exerciseId: string,
    archived: boolean,
  ): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const row = await db.getFirstAsync<DocRow>(
        'SELECT id, data FROM exercises WHERE id = ? AND profile_id = ?',
        exerciseId,
        profileId,
      );
      if (!row) throw new Error('Exercício não encontrado.');
      const parsed = exerciseSchema.parse({ ...JSON.parse(row.data), archived });
      await db.runAsync(
        'UPDATE exercises SET data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
        JSON.stringify(parsed),
        stamp,
        exerciseId,
        profileId,
      );
    });
  }

  async saveTemplate(profileId: string, input: WorkoutTemplate): Promise<void> {
    const template = workoutTemplateSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await this.upsertTemplate(db, profileId, template, stamp);
    });
  }

  async setTemplateArchived(
    profileId: string,
    templateId: string,
    archived: boolean,
  ): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const row = await db.getFirstAsync<DocRow>(
        'SELECT id, data FROM workout_templates WHERE id = ? AND profile_id = ?',
        templateId,
        profileId,
      );
      if (!row) throw new Error('Ficha não encontrada.');
      const items = await db.getAllAsync<DocRow>(
        'SELECT id, data FROM workout_template_exercises WHERE parent_id = ? ORDER BY position',
        templateId,
      );
      const parsed = workoutTemplateSchema.parse({
        ...JSON.parse(row.data),
        archived,
        exercises: items.map((i) => JSON.parse(i.data)),
      });
      const { exercises: _drop, ...header } = parsed;
      await db.runAsync(
        'UPDATE workout_templates SET data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
        JSON.stringify(header),
        stamp,
        templateId,
        profileId,
      );
    });
  }

  async applySeedBundle(
    profileId: string,
    bundle: { exercises: Exercise[]; templates: WorkoutTemplate[] },
  ): Promise<void> {
    const exercises = bundle.exercises.map((e) => exerciseSchema.parse(e));
    const templates = bundle.templates.map((t) => workoutTemplateSchema.parse(t));
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      for (const exercise of exercises) {
        await this.upsertExercise(db, profileId, exercise, stamp);
      }
      for (const template of templates) {
        await this.upsertTemplate(db, profileId, template, stamp);
      }
    });
  }

  async savePlanVersion(profileId: string, input: TrainingPlanVersion): Promise<void> {
    const plan = trainingPlanVersionSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM training_plan_versions WHERE id = ? AND profile_id = ?',
        plan.id,
        profileId,
      );
      if (existing) {
        await db.runAsync(
          'UPDATE training_plan_versions SET effective_from_date = ?, effective_to_date = ?, data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
          plan.effectiveFromDate,
          plan.effectiveToDate,
          JSON.stringify(plan),
          stamp,
          plan.id,
          profileId,
        );
      } else {
        await db.runAsync(
          'INSERT INTO training_plan_versions(id, profile_id, effective_from_date, effective_to_date, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          plan.id,
          profileId,
          plan.effectiveFromDate,
          plan.effectiveToDate,
          JSON.stringify(plan),
          stamp,
          stamp,
        );
      }
    });
  }

  async deletePlanVersion(profileId: string, id: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        'DELETE FROM training_plan_versions WHERE id = ? AND profile_id = ?',
        id,
        profileId,
      );
    });
  }

  async saveDayOverride(profileId: string, input: TrainingDayOverride): Promise<void> {
    const override = trainingDayOverrideSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO training_day_overrides(id, profile_id, local_date, template_id, kind, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, local_date) DO UPDATE SET
           template_id = excluded.template_id,
           kind = excluded.kind,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        override.id,
        profileId,
        override.localDate,
        override.templateId,
        override.kind,
        override.notes,
        stamp,
        stamp,
      );
    });
  }

  async deleteDayOverride(profileId: string, localDate: string): Promise<void> {
    if (!isLocalDate(localDate)) throw new Error('Data civil inválida.');
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        'DELETE FROM training_day_overrides WHERE profile_id = ? AND local_date = ?',
        profileId,
        localDate,
      );
    });
  }

  activeSession(profileId: string): Promise<WorkoutSession | null> {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<{
        id: string;
        template_id: string | null;
        local_date: string;
        started_at: string;
        completed_at: string | null;
        timezone_at_entry: string;
        status: SessionStatus;
        data: string;
      }>(
        "SELECT id, template_id, local_date, started_at, completed_at, timezone_at_entry, status, data FROM workout_sessions WHERE profile_id = ? AND status = 'active'",
        profileId,
      );
      if (!row) return null;
      return this.hydrateSession(db, row);
    });
  }

  sessionById(profileId: string, sessionId: string): Promise<WorkoutSession | null> {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<{
        id: string;
        template_id: string | null;
        local_date: string;
        started_at: string;
        completed_at: string | null;
        timezone_at_entry: string;
        status: SessionStatus;
        data: string;
      }>(
        'SELECT id, template_id, local_date, started_at, completed_at, timezone_at_entry, status, data FROM workout_sessions WHERE id = ? AND profile_id = ?',
        sessionId,
        profileId,
      );
      if (!row) return null;
      return this.hydrateSession(db, row);
    });
  }

  sessionsByDate(profileId: string, localDate: string): Promise<WorkoutSession[]> {
    if (!isLocalDate(localDate)) return Promise.reject(new Error('Data civil inválida.'));
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        template_id: string | null;
        local_date: string;
        started_at: string;
        completed_at: string | null;
        timezone_at_entry: string;
        status: SessionStatus;
        data: string;
      }>(
        'SELECT id, template_id, local_date, started_at, completed_at, timezone_at_entry, status, data FROM workout_sessions WHERE profile_id = ? AND local_date = ? ORDER BY started_at DESC, id',
        profileId,
        localDate,
      );
      const result: WorkoutSession[] = [];
      for (const row of rows) result.push(await this.hydrateSession(db, row));
      return result;
    });
  }

  history(
    profileId: string,
    filters: { limit?: number; status?: SessionStatus; templateId?: string } = {},
  ): Promise<WorkoutSession[]> {
    return this.queue.run(async (db) => {
      const clauses = ['profile_id = ?'];
      const params: (string | number)[] = [profileId];
      if (filters.status) {
        clauses.push('status = ?');
        params.push(filters.status);
      }
      if (filters.templateId) {
        clauses.push('template_id = ?');
        params.push(filters.templateId);
      }
      const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
      const rows = await db.getAllAsync<{
        id: string;
        template_id: string | null;
        local_date: string;
        started_at: string;
        completed_at: string | null;
        timezone_at_entry: string;
        status: SessionStatus;
        data: string;
      }>(
        `SELECT id, template_id, local_date, started_at, completed_at, timezone_at_entry, status, data FROM workout_sessions WHERE ${clauses.join(' AND ')} ORDER BY local_date DESC, started_at DESC LIMIT ?`,
        ...params,
        limit,
      );
      const result: WorkoutSession[] = [];
      for (const row of rows) result.push(await this.hydrateSession(db, row));
      return result;
    });
  }

  async startSession(profileId: string, input: WorkoutSession): Promise<void> {
    const session = workoutSessionSchema.parse({ ...input, status: 'active', completedAt: null });
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const active = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM workout_sessions WHERE profile_id = ? AND status = 'active'",
        profileId,
      );
      if (active) throw new Error('Já existe um treino em andamento.');
      await this.insertOrReplaceSession(db, profileId, session, stamp);
    });
  }

  async saveRetroactiveSession(profileId: string, input: WorkoutSession): Promise<void> {
    const session = workoutSessionSchema.parse({ ...input, status: 'completed' });
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await this.insertOrReplaceSession(db, profileId, session, stamp);
    });
  }

  async upsertSet(
    profileId: string,
    sessionId: string,
    sessionExerciseId: string,
    inputSet: WorkoutSet,
  ): Promise<void> {
    const set = workoutSetSchema.parse(inputSet);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const owner = await db.getFirstAsync<{ id: string }>(
        'SELECT se.id FROM workout_session_exercises se JOIN workout_sessions s ON s.id = se.session_id WHERE se.id = ? AND se.session_id = ? AND s.profile_id = ?',
        sessionExerciseId,
        sessionId,
        profileId,
      );
      if (!owner) throw new Error('Exercício da sessão não encontrado.');
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_sets WHERE id = ? AND session_exercise_id = ?',
        set.id,
        sessionExerciseId,
      );
      if (existing) {
        await db.runAsync(
          'UPDATE workout_sets SET data = ? WHERE id = ? AND session_exercise_id = ?',
          JSON.stringify(set),
          set.id,
          sessionExerciseId,
        );
      } else {
        const posRow = await db.getFirstAsync<{ next_pos: number }>(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM workout_sets WHERE session_exercise_id = ?',
          sessionExerciseId,
        );
        await db.runAsync(
          'INSERT INTO workout_sets(id, session_exercise_id, position, data) VALUES (?, ?, ?, ?)',
          set.id,
          sessionExerciseId,
          posRow?.next_pos ?? 0,
          JSON.stringify(set),
        );
      }
      await db.runAsync(
        'UPDATE workout_sessions SET updated_at = ? WHERE id = ?',
        stamp,
        sessionId,
      );
    });
  }

  async removeSet(
    profileId: string,
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
  ): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const owner = await db.getFirstAsync<{ id: string }>(
        'SELECT se.id FROM workout_session_exercises se JOIN workout_sessions s ON s.id = se.session_id WHERE se.id = ? AND se.session_id = ? AND s.profile_id = ?',
        sessionExerciseId,
        sessionId,
        profileId,
      );
      if (!owner) throw new Error('Exercício da sessão não encontrado.');
      await db.runAsync(
        'DELETE FROM workout_sets WHERE id = ? AND session_exercise_id = ?',
        setId,
        sessionExerciseId,
      );
      const remaining = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM workout_sets WHERE session_exercise_id = ? ORDER BY position',
        sessionExerciseId,
      );
      for (const [index, row] of remaining.entries()) {
        await db.runAsync('UPDATE workout_sets SET position = ? WHERE id = ?', index, row.id);
      }
      await db.runAsync(
        'UPDATE workout_sessions SET updated_at = ? WHERE id = ?',
        stamp,
        sessionId,
      );
    });
  }

  async addExerciseToSession(
    profileId: string,
    sessionId: string,
    inputExercise: SessionExercise,
  ): Promise<void> {
    const ex = sessionExerciseSchema.parse(inputExercise);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const session = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_sessions WHERE id = ? AND profile_id = ?',
        sessionId,
        profileId,
      );
      if (!session) throw new Error('Sessão não encontrada.');
      const posRow = await db.getFirstAsync<{ next_pos: number }>(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM workout_session_exercises WHERE session_id = ?',
        sessionId,
      );
      const { sets, ...header } = ex;
      await db.runAsync(
        'INSERT INTO workout_session_exercises(id, session_id, position, exercise_id, data) VALUES (?, ?, ?, ?, ?)',
        ex.id,
        sessionId,
        posRow?.next_pos ?? 0,
        ex.exerciseId,
        JSON.stringify(header),
      );
      for (const [index, set] of sets.entries()) {
        await db.runAsync(
          'INSERT INTO workout_sets(id, session_exercise_id, position, data) VALUES (?, ?, ?, ?)',
          set.id,
          ex.id,
          index,
          JSON.stringify(set),
        );
      }
      await db.runAsync(
        'UPDATE workout_sessions SET updated_at = ? WHERE id = ?',
        stamp,
        sessionId,
      );
    });
  }

  async replaceSessionExercise(
    profileId: string,
    sessionId: string,
    inputExercise: SessionExercise,
  ): Promise<void> {
    const ex = sessionExerciseSchema.parse(inputExercise);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const owner = await db.getFirstAsync<{ id: string }>(
        'SELECT se.id FROM workout_session_exercises se JOIN workout_sessions s ON s.id = se.session_id WHERE se.id = ? AND se.session_id = ? AND s.profile_id = ?',
        ex.id,
        sessionId,
        profileId,
      );
      if (!owner) throw new Error('Exercício da sessão não encontrado.');
      const { sets, ...header } = ex;
      await db.runAsync(
        'UPDATE workout_session_exercises SET exercise_id = ?, data = ? WHERE id = ?',
        ex.exerciseId,
        JSON.stringify(header),
        ex.id,
      );
      await db.runAsync('DELETE FROM workout_sets WHERE session_exercise_id = ?', ex.id);
      for (const [index, set] of sets.entries()) {
        await db.runAsync(
          'INSERT INTO workout_sets(id, session_exercise_id, position, data) VALUES (?, ?, ?, ?)',
          set.id,
          ex.id,
          index,
          JSON.stringify(set),
        );
      }
      await db.runAsync(
        'UPDATE workout_sessions SET updated_at = ? WHERE id = ?',
        stamp,
        sessionId,
      );
    });
  }

  async removeSessionExercise(
    profileId: string,
    sessionId: string,
    sessionExerciseId: string,
  ): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const owner = await db.getFirstAsync<{ id: string }>(
        'SELECT se.id FROM workout_session_exercises se JOIN workout_sessions s ON s.id = se.session_id WHERE se.id = ? AND se.session_id = ? AND s.profile_id = ?',
        sessionExerciseId,
        sessionId,
        profileId,
      );
      if (!owner) throw new Error('Exercício da sessão não encontrado.');
      await db.runAsync('DELETE FROM workout_session_exercises WHERE id = ?', sessionExerciseId);
      const remaining = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM workout_session_exercises WHERE session_id = ? ORDER BY position',
        sessionId,
      );
      for (const [index, row] of remaining.entries()) {
        await db.runAsync(
          'UPDATE workout_session_exercises SET position = ? WHERE id = ?',
          index,
          row.id,
        );
      }
      await db.runAsync(
        'UPDATE workout_sessions SET updated_at = ? WHERE id = ?',
        stamp,
        sessionId,
      );
    });
  }

  async updateRestTimer(profileId: string, sessionId: string, restTimer: RestTimer): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const row = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM workout_sessions WHERE id = ? AND profile_id = ?',
        sessionId,
        profileId,
      );
      if (!row) throw new Error('Sessão não encontrada.');
      const nextData = { ...JSON.parse(row.data), restTimer };
      await db.runAsync(
        'UPDATE workout_sessions SET data = ?, updated_at = ? WHERE id = ?',
        JSON.stringify(nextData),
        stamp,
        sessionId,
      );
    });
  }

  async completeSession(profileId: string, sessionId: string): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const row = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM workout_sessions WHERE id = ? AND profile_id = ?',
        sessionId,
        profileId,
      );
      if (!row) throw new Error('Sessão não encontrada.');
      const nextData = {
        ...JSON.parse(row.data),
        restTimer: { targetEndAt: null, durationSeconds: 0 },
      };
      await db.runAsync(
        "UPDATE workout_sessions SET status = 'completed', completed_at = ?, data = ?, updated_at = ? WHERE id = ? AND profile_id = ?",
        stamp,
        JSON.stringify(nextData),
        stamp,
        sessionId,
        profileId,
      );
    });
  }

  async cancelSession(profileId: string, sessionId: string): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      const row = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM workout_sessions WHERE id = ? AND profile_id = ?',
        sessionId,
        profileId,
      );
      if (!row) throw new Error('Sessão não encontrada.');
      const nextData = {
        ...JSON.parse(row.data),
        restTimer: { targetEndAt: null, durationSeconds: 0 },
      };
      await db.runAsync(
        "UPDATE workout_sessions SET status = 'cancelled', completed_at = NULL, data = ?, updated_at = ? WHERE id = ? AND profile_id = ?",
        JSON.stringify(nextData),
        stamp,
        sessionId,
        profileId,
      );
    });
  }

  findLastComparableExercise(
    profileId: string,
    exerciseId: string,
    loadConvention: LoadConvention,
    excludeSessionId?: string,
  ): Promise<{ sessionId: string; localDate: string; sets: WorkoutSet[] } | null> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        session_id: string;
        local_date: string;
        session_exercise_id: string;
        data: string;
      }>(
        `SELECT s.id AS session_id, s.local_date, se.id AS session_exercise_id, se.data
         FROM workout_session_exercises se
         JOIN workout_sessions s ON s.id = se.session_id
         WHERE s.profile_id = ? AND s.status = 'completed' AND se.exercise_id = ?
         ORDER BY s.local_date DESC, s.started_at DESC`,
        profileId,
        exerciseId,
      );
      for (const row of rows) {
        if (excludeSessionId && row.session_id === excludeSessionId) continue;
        const header = JSON.parse(row.data) as { loadConvention?: LoadConvention };
        if (header.loadConvention !== loadConvention) continue;
        const setRows = await db.getAllAsync<DocRow>(
          'SELECT id, data FROM workout_sets WHERE session_exercise_id = ? ORDER BY position',
          row.session_exercise_id,
        );
        const sets = setRows.map((sr) => workoutSetSchema.parse(JSON.parse(sr.data)));
        if (sets.length) return { sessionId: row.session_id, localDate: row.local_date, sets };
      }
      return null;
    });
  }

  cardioByDate(profileId: string, localDate: string): Promise<CardioEntry[]> {
    if (!isLocalDate(localDate)) return Promise.reject(new Error('Data civil inválida.'));
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        session_id: string | null;
        local_date: string;
        occurred_at: string;
        timezone_at_entry: string;
        duration_minutes: number;
        distance_km: number | null;
        data: string;
      }>(
        'SELECT id, session_id, local_date, occurred_at, timezone_at_entry, duration_minutes, distance_km, data FROM cardio_entries WHERE profile_id = ? AND local_date = ? ORDER BY occurred_at DESC, id',
        profileId,
        localDate,
      );
      return rows.map((r) => this.parseCardioRow(r));
    });
  }

  cardioHistory(profileId: string, limit = 50): Promise<CardioEntry[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        session_id: string | null;
        local_date: string;
        occurred_at: string;
        timezone_at_entry: string;
        duration_minutes: number;
        distance_km: number | null;
        data: string;
      }>(
        'SELECT id, session_id, local_date, occurred_at, timezone_at_entry, duration_minutes, distance_km, data FROM cardio_entries WHERE profile_id = ? ORDER BY local_date DESC, occurred_at DESC LIMIT ?',
        profileId,
        Math.max(1, Math.min(200, limit)),
      );
      return rows.map((r) => this.parseCardioRow(r));
    });
  }

  async saveCardio(profileId: string, input: CardioEntry): Promise<void> {
    const entry = cardioEntrySchema.parse(input);
    const stamp = this.now().toISOString();
    const doc = {
      id: entry.id,
      modality: entry.modality,
      intensity: entry.intensity,
      notes: entry.notes,
    };
    await this.queue.transaction(async (db) => {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM cardio_entries WHERE id = ? AND profile_id = ?',
        entry.id,
        profileId,
      );
      if (existing) {
        await db.runAsync(
          'UPDATE cardio_entries SET session_id = ?, local_date = ?, occurred_at = ?, timezone_at_entry = ?, duration_minutes = ?, distance_km = ?, data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
          entry.sessionId,
          entry.localDate,
          entry.occurredAt,
          entry.timezoneAtEntry,
          entry.durationMinutes,
          entry.distanceKm,
          JSON.stringify(doc),
          stamp,
          entry.id,
          profileId,
        );
      } else {
        await db.runAsync(
          'INSERT INTO cardio_entries(id, profile_id, session_id, local_date, occurred_at, timezone_at_entry, duration_minutes, distance_km, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          entry.id,
          profileId,
          entry.sessionId,
          entry.localDate,
          entry.occurredAt,
          entry.timezoneAtEntry,
          entry.durationMinutes,
          entry.distanceKm,
          JSON.stringify(doc),
          stamp,
          stamp,
        );
      }
    });
  }

  async unlinkCardio(profileId: string, cardioId: string): Promise<void> {
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        'UPDATE cardio_entries SET session_id = NULL, updated_at = ? WHERE id = ? AND profile_id = ?',
        stamp,
        cardioId,
        profileId,
      );
    });
  }

  async deleteCardio(profileId: string, cardioId: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        'DELETE FROM cardio_entries WHERE id = ? AND profile_id = ?',
        cardioId,
        profileId,
      );
    });
  }

  private async upsertExercise(
    db: SqlConnection,
    profileId: string,
    exercise: Exercise,
    stamp: string,
  ): Promise<void> {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM exercises WHERE id = ? AND profile_id = ?',
      exercise.id,
      profileId,
    );
    if (existing) {
      await db.runAsync(
        'UPDATE exercises SET data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
        JSON.stringify(exercise),
        stamp,
        exercise.id,
        profileId,
      );
    } else {
      await db.runAsync(
        'INSERT INTO exercises(id, profile_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        exercise.id,
        profileId,
        JSON.stringify(exercise),
        stamp,
        stamp,
      );
    }
  }

  private async upsertTemplate(
    db: SqlConnection,
    profileId: string,
    template: WorkoutTemplate,
    stamp: string,
  ): Promise<void> {
    const { exercises, ...header } = template;
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workout_templates WHERE id = ? AND profile_id = ?',
      template.id,
      profileId,
    );
    if (existing) {
      await db.runAsync(
        'UPDATE workout_templates SET data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
        JSON.stringify(header),
        stamp,
        template.id,
        profileId,
      );
      await db.runAsync('DELETE FROM workout_template_exercises WHERE parent_id = ?', template.id);
    } else {
      await db.runAsync(
        'INSERT INTO workout_templates(id, profile_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        template.id,
        profileId,
        JSON.stringify(header),
        stamp,
        stamp,
      );
    }
    for (const [index, item] of exercises.entries()) {
      await db.runAsync(
        'INSERT INTO workout_template_exercises(id, parent_id, position, exercise_id, data) VALUES (?, ?, ?, ?, ?)',
        item.id,
        template.id,
        index,
        item.exerciseId,
        JSON.stringify(item),
      );
    }
  }

  private async insertOrReplaceSession(
    db: SqlConnection,
    profileId: string,
    session: WorkoutSession,
    stamp: string,
  ): Promise<void> {
    const { exercises, ...header } = session;
    const headerDoc = {
      id: header.id,
      title: header.title,
      sourceTemplateName: header.sourceTemplateName,
      notes: header.notes,
      restTimer: header.restTimer,
    };
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workout_sessions WHERE id = ? AND profile_id = ?',
      session.id,
      profileId,
    );
    if (existing) {
      await db.runAsync(
        'UPDATE workout_sessions SET template_id = ?, local_date = ?, started_at = ?, completed_at = ?, timezone_at_entry = ?, status = ?, data = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
        session.templateId,
        session.localDate,
        session.startedAt,
        session.completedAt,
        session.timezoneAtEntry,
        session.status,
        JSON.stringify(headerDoc),
        stamp,
        session.id,
        profileId,
      );
      await db.runAsync('DELETE FROM workout_session_exercises WHERE session_id = ?', session.id);
    } else {
      await db.runAsync(
        'INSERT INTO workout_sessions(id, profile_id, template_id, local_date, started_at, completed_at, timezone_at_entry, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        session.id,
        profileId,
        session.templateId,
        session.localDate,
        session.startedAt,
        session.completedAt,
        session.timezoneAtEntry,
        session.status,
        JSON.stringify(headerDoc),
        stamp,
        stamp,
      );
    }
    for (const [exIndex, ex] of exercises.entries()) {
      const { sets, ...exHeader } = ex;
      await db.runAsync(
        'INSERT INTO workout_session_exercises(id, session_id, position, exercise_id, data) VALUES (?, ?, ?, ?, ?)',
        ex.id,
        session.id,
        exIndex,
        ex.exerciseId,
        JSON.stringify(exHeader),
      );
      for (const [setIndex, set] of sets.entries()) {
        await db.runAsync(
          'INSERT INTO workout_sets(id, session_exercise_id, position, data) VALUES (?, ?, ?, ?)',
          set.id,
          ex.id,
          setIndex,
          JSON.stringify(set),
        );
      }
    }
  }

  private async hydrateSession(
    db: SqlConnection,
    row: {
      id: string;
      template_id: string | null;
      local_date: string;
      started_at: string;
      completed_at: string | null;
      timezone_at_entry: string;
      status: SessionStatus;
      data: string;
    },
  ): Promise<WorkoutSession> {
    const header = JSON.parse(row.data);
    const exRows = await db.getAllAsync<{ id: string; exercise_id: string | null; data: string }>(
      'SELECT id, exercise_id, data FROM workout_session_exercises WHERE session_id = ? ORDER BY position',
      row.id,
    );
    const exercises: SessionExercise[] = [];
    for (const exRow of exRows) {
      const setRows = await db.getAllAsync<DocRow>(
        'SELECT id, data FROM workout_sets WHERE session_exercise_id = ? ORDER BY position',
        exRow.id,
      );
      exercises.push(
        sessionExerciseSchema.parse({
          ...JSON.parse(exRow.data),
          exerciseId: exRow.exercise_id,
          sets: setRows.map((sr) => JSON.parse(sr.data)),
        }),
      );
    }
    return workoutSessionSchema.parse({
      ...header,
      id: row.id,
      templateId: row.template_id,
      localDate: row.local_date,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      timezoneAtEntry: row.timezone_at_entry,
      status: row.status,
      exercises,
    });
  }

  private parseCardioRow(row: {
    id: string;
    session_id: string | null;
    local_date: string;
    occurred_at: string;
    timezone_at_entry: string;
    duration_minutes: number;
    distance_km: number | null;
    data: string;
  }): CardioEntry {
    const doc = JSON.parse(row.data);
    return cardioEntrySchema.parse({
      ...doc,
      id: row.id,
      sessionId: row.session_id,
      localDate: row.local_date,
      occurredAt: row.occurred_at,
      timezoneAtEntry: row.timezone_at_entry,
      durationMinutes: row.duration_minutes,
      distanceKm: row.distance_km,
    });
  }
}
