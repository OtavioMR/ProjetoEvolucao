import { shiftDate } from '../../date-time/event-time.ts';
import { DatabaseQueue } from '../connection.ts';
import {
  bodyMilestoneSchema,
  dailyMeasurementSeries,
  dailyWeightSeries,
  habitLogSchema,
  habitSchema,
  measurementEntrySchema,
  sleepEntrySchema,
  summarizeSleepDay,
  weekdayOfLocalDate,
  weeklyReviewSchema,
  weightEntrySchema,
  type BodyMilestone,
  type Habit,
  type HabitLog,
  type MeasurementEntry,
  type PeriodReportInput,
  type SleepEntry,
  type WeeklyReview,
  type WeightEntry,
} from '../../../domain/evolution/evolution.ts';
import { itemSchema, mealSchema, summarize } from '../../../domain/nutrition/nutrition.ts';
import type { Preferences } from '../../../domain/profile/profile.ts';
import {
  resolvePlannedDay,
  trainingDayOverrideSchema,
  trainingPlanVersionSchema,
  workoutTemplateSchema,
  type TrainingDayOverride,
  type TrainingPlanVersion,
  type WorkoutTemplate,
} from '../../../domain/training/training.ts';

export type MonthActivityMap = Record<
  string,
  {
    meals: number;
    waterMl: number;
    workouts: number;
    cardioMinutes: number;
    sleepMinutes: number;
    weightKg: number | null;
    habitsDone: number;
  }
>;

export class EvolutionRepository {
  private readonly queue: DatabaseQueue;
  private readonly now: () => Date;
  constructor(queue: DatabaseQueue, now: () => Date = () => new Date()) {
    this.queue = queue;
    this.now = now;
  }

  listWeights(profileId: string): Promise<WeightEntry[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        local_date: string;
        occurred_at: string;
        timezone_at_entry: string;
        weight_kg: number;
        notes: string;
      }>(
        'SELECT id, local_date, occurred_at, timezone_at_entry, weight_kg, notes FROM weight_entries WHERE profile_id = ? ORDER BY occurred_at DESC',
        profileId,
      );
      return rows.map((r) =>
        weightEntrySchema.parse({
          id: r.id,
          localDate: r.local_date,
          occurredAt: r.occurred_at,
          timezoneAtEntry: r.timezone_at_entry,
          weightKg: r.weight_kg,
          notes: r.notes,
        }),
      );
    });
  }

  async saveWeight(profileId: string, input: WeightEntry): Promise<void> {
    const entry = weightEntrySchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO weight_entries(id, profile_id, local_date, occurred_at, timezone_at_entry, weight_kg, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           local_date = excluded.local_date,
           occurred_at = excluded.occurred_at,
           timezone_at_entry = excluded.timezone_at_entry,
           weight_kg = excluded.weight_kg,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        entry.id,
        profileId,
        entry.localDate,
        entry.occurredAt,
        entry.timezoneAtEntry,
        entry.weightKg,
        entry.notes,
        stamp,
        stamp,
      );
    });
  }

  async deleteWeight(id: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync('DELETE FROM weight_entries WHERE id = ?', id);
    });
  }

  listMeasurements(profileId: string): Promise<MeasurementEntry[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        local_date: string;
        occurred_at: string;
        timezone_at_entry: string;
        metric: string;
        value_cm: number;
        notes: string;
      }>(
        'SELECT id, local_date, occurred_at, timezone_at_entry, metric, value_cm, notes FROM measurement_entries WHERE profile_id = ? ORDER BY occurred_at DESC',
        profileId,
      );
      return rows.map((r) =>
        measurementEntrySchema.parse({
          id: r.id,
          localDate: r.local_date,
          occurredAt: r.occurred_at,
          timezoneAtEntry: r.timezone_at_entry,
          metric: r.metric,
          valueCm: r.value_cm,
          notes: r.notes,
        }),
      );
    });
  }

  async saveMeasurements(profileId: string, inputs: MeasurementEntry[]): Promise<void> {
    const entries = inputs.map((item) => measurementEntrySchema.parse(item));
    if (entries.length === 0) return;
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      for (const entry of entries) {
        await db.runAsync(
          `INSERT INTO measurement_entries(id, profile_id, local_date, occurred_at, timezone_at_entry, metric, value_cm, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             local_date = excluded.local_date,
             occurred_at = excluded.occurred_at,
             timezone_at_entry = excluded.timezone_at_entry,
             metric = excluded.metric,
             value_cm = excluded.value_cm,
             notes = excluded.notes,
             updated_at = excluded.updated_at`,
          entry.id,
          profileId,
          entry.localDate,
          entry.occurredAt,
          entry.timezoneAtEntry,
          entry.metric,
          entry.valueCm,
          entry.notes,
          stamp,
          stamp,
        );
      }
    });
  }

  async deleteMeasurement(id: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync('DELETE FROM measurement_entries WHERE id = ?', id);
    });
  }

  listMilestones(profileId: string): Promise<BodyMilestone[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{
        id: string;
        title: string;
        target_weight_kg: number;
        achieved_at: string | null;
        notes: string;
      }>(
        'SELECT id, title, target_weight_kg, achieved_at, notes FROM body_milestones WHERE profile_id = ? ORDER BY target_weight_kg DESC',
        profileId,
      );
      return rows.map((r) =>
        bodyMilestoneSchema.parse({
          id: r.id,
          title: r.title,
          targetWeightKg: r.target_weight_kg,
          achievedAt: r.achieved_at,
          notes: r.notes,
        }),
      );
    });
  }

  async saveMilestone(profileId: string, input: BodyMilestone): Promise<void> {
    const milestone = bodyMilestoneSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO body_milestones(id, profile_id, title, target_weight_kg, achieved_at, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           target_weight_kg = excluded.target_weight_kg,
           achieved_at = excluded.achieved_at,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        milestone.id,
        profileId,
        milestone.title,
        milestone.targetWeightKg,
        milestone.achievedAt,
        milestone.notes,
        stamp,
        stamp,
      );
    });
  }

  async saveMilestonesBatch(profileId: string, inputs: BodyMilestone[]): Promise<void> {
    const items = inputs.map((m) => bodyMilestoneSchema.parse(m));
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      for (const milestone of items) {
        await db.runAsync(
          `INSERT INTO body_milestones(id, profile_id, title, target_weight_kg, achieved_at, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          milestone.id,
          profileId,
          milestone.title,
          milestone.targetWeightKg,
          milestone.achievedAt,
          milestone.notes,
          stamp,
          stamp,
        );
      }
    });
  }

  async deleteMilestone(id: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync('DELETE FROM body_milestones WHERE id = ?', id);
    });
  }

  listSleep(profileId: string, wakeLocalDate?: string): Promise<SleepEntry[]> {
    return this.queue.run(async (db) => {
      const rows = wakeLocalDate
        ? await db.getAllAsync<{
            id: string;
            start_at: string;
            end_at: string;
            wake_local_date: string;
            timezone_at_entry: string;
            is_nap: number;
            quality: number | null;
            notes: string;
          }>(
            'SELECT id, start_at, end_at, wake_local_date, timezone_at_entry, is_nap, quality, notes FROM sleep_entries WHERE profile_id = ? AND wake_local_date = ? ORDER BY start_at DESC',
            profileId,
            wakeLocalDate,
          )
        : await db.getAllAsync<{
            id: string;
            start_at: string;
            end_at: string;
            wake_local_date: string;
            timezone_at_entry: string;
            is_nap: number;
            quality: number | null;
            notes: string;
          }>(
            'SELECT id, start_at, end_at, wake_local_date, timezone_at_entry, is_nap, quality, notes FROM sleep_entries WHERE profile_id = ? ORDER BY wake_local_date DESC, start_at DESC',
            profileId,
          );
      return rows.map((r) =>
        sleepEntrySchema.parse({
          id: r.id,
          startAt: r.start_at,
          endAt: r.end_at,
          wakeLocalDate: r.wake_local_date,
          timezoneAtEntry: r.timezone_at_entry,
          isNap: r.is_nap === 1,
          quality: r.quality,
          notes: r.notes,
        }),
      );
    });
  }

  async saveSleep(profileId: string, input: SleepEntry): Promise<void> {
    const entry = sleepEntrySchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO sleep_entries(id, profile_id, start_at, end_at, wake_local_date, timezone_at_entry, is_nap, quality, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           start_at = excluded.start_at,
           end_at = excluded.end_at,
           wake_local_date = excluded.wake_local_date,
           timezone_at_entry = excluded.timezone_at_entry,
           is_nap = excluded.is_nap,
           quality = excluded.quality,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        entry.id,
        profileId,
        entry.startAt,
        entry.endAt,
        entry.wakeLocalDate,
        entry.timezoneAtEntry,
        entry.isNap ? 1 : 0,
        entry.quality,
        entry.notes,
        stamp,
        stamp,
      );
    });
  }

  async deleteSleep(id: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync('DELETE FROM sleep_entries WHERE id = ?', id);
    });
  }

  listHabits(profileId: string, includeArchived = true): Promise<Habit[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<{ data: string; archived_at: string | null }>(
        includeArchived
          ? 'SELECT data, archived_at FROM habits WHERE profile_id = ? ORDER BY created_at ASC'
          : 'SELECT data, archived_at FROM habits WHERE profile_id = ? AND archived_at IS NULL ORDER BY created_at ASC',
        profileId,
      );
      return rows
        .map((r) => habitSchema.parse({ ...JSON.parse(r.data), archivedAt: r.archived_at }))
        .sort((a, b) => a.position - b.position);
    });
  }

  async saveHabit(profileId: string, input: Habit): Promise<void> {
    const habit = habitSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO habits(id, profile_id, data, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           data = excluded.data,
           archived_at = excluded.archived_at,
           updated_at = excluded.updated_at`,
        habit.id,
        profileId,
        JSON.stringify(habit),
        habit.archivedAt,
        stamp,
        stamp,
      );
    });
  }

  async saveHabitsBatch(profileId: string, inputs: Habit[]): Promise<void> {
    const habits = inputs.map((h) => habitSchema.parse(h));
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      for (const habit of habits) {
        await db.runAsync(
          `INSERT INTO habits(id, profile_id, data, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          habit.id,
          profileId,
          JSON.stringify(habit),
          habit.archivedAt,
          stamp,
          stamp,
        );
      }
    });
  }

  listHabitLogs(profileId: string, localDate?: string): Promise<HabitLog[]> {
    return this.queue.run(async (db) => {
      const rows = localDate
        ? await db.getAllAsync<{
            id: string;
            habit_id: string;
            local_date: string;
            status: string;
            notes: string;
          }>(
            'SELECT id, habit_id, local_date, status, notes FROM habit_logs WHERE profile_id = ? AND local_date = ?',
            profileId,
            localDate,
          )
        : await db.getAllAsync<{
            id: string;
            habit_id: string;
            local_date: string;
            status: string;
            notes: string;
          }>(
            'SELECT id, habit_id, local_date, status, notes FROM habit_logs WHERE profile_id = ?',
            profileId,
          );
      return rows.map((r) =>
        habitLogSchema.parse({
          id: r.id,
          habitId: r.habit_id,
          localDate: r.local_date,
          status: r.status,
          notes: r.notes,
        }),
      );
    });
  }

  async upsertHabitLog(profileId: string, input: HabitLog): Promise<void> {
    const log = habitLogSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO habit_logs(id, profile_id, habit_id, local_date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(habit_id, local_date) DO UPDATE SET
           status = excluded.status,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        log.id,
        profileId,
        log.habitId,
        log.localDate,
        log.status,
        log.notes,
        stamp,
        stamp,
      );
    });
  }

  async clearHabitLog(habitId: string, localDate: string): Promise<void> {
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        'DELETE FROM habit_logs WHERE habit_id = ? AND local_date = ?',
        habitId,
        localDate,
      );
    });
  }

  getWeeklyReview(profileId: string, weekStartDate: string): Promise<WeeklyReview | null> {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM weekly_reviews WHERE profile_id = ? AND week_start_date = ?',
        profileId,
        weekStartDate,
      );
      return row ? weeklyReviewSchema.parse(JSON.parse(row.data)) : null;
    });
  }

  async saveWeeklyReview(profileId: string, input: WeeklyReview): Promise<void> {
    const review = weeklyReviewSchema.parse(input);
    const stamp = this.now().toISOString();
    await this.queue.transaction(async (db) => {
      await db.runAsync(
        `INSERT INTO weekly_reviews(id, profile_id, week_start_date, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, week_start_date) DO UPDATE SET
           data = excluded.data,
           updated_at = excluded.updated_at`,
        review.id,
        profileId,
        review.weekStartDate,
        JSON.stringify(review),
        stamp,
        stamp,
      );
    });
  }

  monthActivity(profileId: string, startDate: string, endDate: string): Promise<MonthActivityMap> {
    return this.queue.run(async (db) => {
      const map: MonthActivityMap = {};
      const ensure = (date: string) => {
        if (!map[date]) {
          map[date] = {
            meals: 0,
            waterMl: 0,
            workouts: 0,
            cardioMinutes: 0,
            sleepMinutes: 0,
            weightKg: null,
            habitsDone: 0,
          };
        }
        return map[date]!;
      };

      const meals = await db.getAllAsync<{ local_date: string; n: number }>(
        'SELECT local_date, COUNT(*) AS n FROM meals WHERE profile_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date',
        profileId,
        startDate,
        endDate,
      );
      for (const row of meals) ensure(row.local_date).meals = row.n;

      const water = await db.getAllAsync<{ local_date: string; ml: number }>(
        "SELECT local_date, SUM(amount_ml) AS ml FROM water_entries WHERE profile_id = ? AND beverage_type = 'water' AND local_date BETWEEN ? AND ? GROUP BY local_date",
        profileId,
        startDate,
        endDate,
      );
      for (const row of water) ensure(row.local_date).waterMl = row.ml ?? 0;

      const workouts = await db.getAllAsync<{ local_date: string; n: number }>(
        "SELECT local_date, COUNT(*) AS n FROM workout_sessions WHERE profile_id = ? AND status = 'completed' AND local_date BETWEEN ? AND ? GROUP BY local_date",
        profileId,
        startDate,
        endDate,
      );
      for (const row of workouts) ensure(row.local_date).workouts = row.n;

      const cardio = await db.getAllAsync<{ local_date: string; mins: number }>(
        'SELECT local_date, SUM(duration_minutes) AS mins FROM cardio_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date',
        profileId,
        startDate,
        endDate,
      );
      for (const row of cardio) ensure(row.local_date).cardioMinutes = row.mins ?? 0;

      const sleepRows = await db.getAllAsync<{
        id: string;
        start_at: string;
        end_at: string;
        wake_local_date: string;
        timezone_at_entry: string;
        is_nap: number;
        quality: number | null;
        notes: string;
      }>(
        'SELECT id, start_at, end_at, wake_local_date, timezone_at_entry, is_nap, quality, notes FROM sleep_entries WHERE profile_id = ? AND wake_local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      const sleepByDate = new Map<string, SleepEntry[]>();
      for (const r of sleepRows) {
        const entry = sleepEntrySchema.parse({
          id: r.id,
          startAt: r.start_at,
          endAt: r.end_at,
          wakeLocalDate: r.wake_local_date,
          timezoneAtEntry: r.timezone_at_entry,
          isNap: r.is_nap === 1,
          quality: r.quality,
          notes: r.notes,
        });
        const list = sleepByDate.get(entry.wakeLocalDate) ?? [];
        list.push(entry);
        sleepByDate.set(entry.wakeLocalDate, list);
      }
      for (const [date, list] of sleepByDate.entries()) {
        ensure(date).sleepMinutes = summarizeSleepDay(list).totalMinutes;
      }

      const weightRows = await db.getAllAsync<{
        id: string;
        local_date: string;
        occurred_at: string;
        timezone_at_entry: string;
        weight_kg: number;
        notes: string;
      }>(
        'SELECT id, local_date, occurred_at, timezone_at_entry, weight_kg, notes FROM weight_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      const dailyWeights = dailyWeightSeries(
        weightRows.map((r) =>
          weightEntrySchema.parse({
            id: r.id,
            localDate: r.local_date,
            occurredAt: r.occurred_at,
            timezoneAtEntry: r.timezone_at_entry,
            weightKg: r.weight_kg,
            notes: r.notes,
          }),
        ),
      );
      for (const pt of dailyWeights) ensure(pt.localDate).weightKg = pt.value;

      const habits = await db.getAllAsync<{ local_date: string; n: number }>(
        "SELECT local_date, COUNT(*) AS n FROM habit_logs WHERE profile_id = ? AND status = 'done' AND local_date BETWEEN ? AND ? GROUP BY local_date",
        profileId,
        startDate,
        endDate,
      );
      for (const row of habits) ensure(row.local_date).habitsDone = row.n;

      return map;
    });
  }

  periodReport(
    profileId: string,
    startDate: string,
    endDate: string,
    visibility: Preferences['visibility'],
  ): Promise<PeriodReportInput> {
    return this.queue.run(async (db) => {
      const dates: string[] = [];
      let cursor = startDate;
      while (cursor <= endDate && dates.length <= 62) {
        dates.push(cursor);
        cursor = shiftDate(cursor, 1);
      }
      const totalDays = dates.length;
      const daysWithData = new Set<string>();

      const mealRows = await db.getAllAsync<{ id: string; local_date: string; data: string }>(
        'SELECT id, local_date, data FROM meals WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      const mealItemsRows = await db.getAllAsync<{ parent_id: string; data: string }>(
        'SELECT mi.parent_id, mi.data FROM meal_items mi JOIN meals m ON m.id = mi.parent_id WHERE m.profile_id = ? AND m.local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      const itemsByMeal = new Map<string, ReturnType<typeof itemSchema.parse>[]>();
      for (const row of mealItemsRows) {
        const list = itemsByMeal.get(row.parent_id) ?? [];
        list.push(itemSchema.parse(JSON.parse(row.data)));
        itemsByMeal.set(row.parent_id, list);
      }
      const mealDates = new Set<string>();
      const contextCounts = new Map<string, number>();
      const itemsByDate = new Map<string, ReturnType<typeof itemSchema.parse>[]>();
      for (const m of mealRows) {
        mealDates.add(m.local_date);
        daysWithData.add(m.local_date);
        const parsed = mealSchema.parse({
          ...JSON.parse(m.data),
          items: itemsByMeal.get(m.id) ?? [],
        });
        if (parsed.context) {
          contextCounts.set(parsed.context, (contextCounts.get(parsed.context) ?? 0) + 1);
        }
        const dayList = itemsByDate.get(m.local_date) ?? [];
        dayList.push(...parsed.items);
        itemsByDate.set(m.local_date, dayList);
      }

      let energySum = 0;
      let energyCompleteDays = 0;
      let proteinSum = 0;
      let proteinCompleteDays = 0;
      for (const dayItems of itemsByDate.values()) {
        const summary = summarize(dayItems);
        if (visibility.calories && summary.complete.kcal && summary.nutrients.kcal !== null) {
          energySum += summary.nutrients.kcal;
          energyCompleteDays += 1;
        }
        if (visibility.macros && summary.complete.protein && summary.nutrients.protein !== null) {
          proteinSum += summary.nutrients.protein;
          proteinCompleteDays += 1;
        }
      }

      const waterRows = await db.getAllAsync<{ local_date: string; ml: number }>(
        "SELECT local_date, SUM(amount_ml) AS ml FROM water_entries WHERE profile_id = ? AND beverage_type = 'water' AND local_date BETWEEN ? AND ? GROUP BY local_date",
        profileId,
        startDate,
        endDate,
      );
      for (const r of waterRows) daysWithData.add(r.local_date);
      const waterDays = waterRows.length;
      const waterAvgMl =
        waterDays > 0
          ? Math.round(waterRows.reduce((s, r) => s + (r.ml ?? 0), 0) / waterDays)
          : null;

      const workoutRows = await db.getAllAsync<{ local_date: string }>(
        "SELECT local_date FROM workout_sessions WHERE profile_id = ? AND status = 'completed' AND local_date BETWEEN ? AND ?",
        profileId,
        startDate,
        endDate,
      );
      for (const r of workoutRows) daysWithData.add(r.local_date);
      const completedWorkouts = workoutRows.length;

      const planRows = await db.getAllAsync<{
        effective_from_date: string;
        effective_to_date: string | null;
        data: string;
      }>(
        'SELECT effective_from_date, effective_to_date, data FROM training_plan_versions WHERE profile_id = ?',
        profileId,
      );
      const plans: TrainingPlanVersion[] = planRows.map((p) =>
        trainingPlanVersionSchema.parse({
          ...JSON.parse(p.data),
          effectiveFromDate: p.effective_from_date,
          effectiveToDate: p.effective_to_date,
        }),
      );
      const overrideRows = await db.getAllAsync<{
        id: string;
        local_date: string;
        kind: string;
        template_id: string | null;
        notes: string;
      }>(
        'SELECT id, local_date, kind, template_id, notes FROM training_day_overrides WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      const overrides: TrainingDayOverride[] = overrideRows.map((o) =>
        trainingDayOverrideSchema.parse({
          id: o.id,
          localDate: o.local_date,
          kind: o.kind,
          templateId: o.template_id,
          notes: o.notes,
        }),
      );
      const templateRows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM workout_templates WHERE profile_id = ?',
        profileId,
      );
      const templates: WorkoutTemplate[] = templateRows.map((t) =>
        workoutTemplateSchema.parse({ ...JSON.parse(t.data), exercises: [] }),
      );
      let plannedWorkouts = 0;
      for (const d of dates) {
        const resolved = resolvePlannedDay(d, plans, overrides, templates);
        if (resolved.kind === 'template') plannedWorkouts += 1;
      }

      const cardioRows = await db.getAllAsync<{ local_date: string; duration_minutes: number }>(
        'SELECT local_date, duration_minutes FROM cardio_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      for (const r of cardioRows) daysWithData.add(r.local_date);
      const cardioMinutes = cardioRows.reduce((s, r) => s + r.duration_minutes, 0);

      let weightAvgKg: number | null = null;
      let weightDays = 0;
      if (visibility.weight) {
        const weightRows = await db.getAllAsync<{
          id: string;
          local_date: string;
          occurred_at: string;
          timezone_at_entry: string;
          weight_kg: number;
          notes: string;
        }>(
          'SELECT id, local_date, occurred_at, timezone_at_entry, weight_kg, notes FROM weight_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
          profileId,
          startDate,
          endDate,
        );
        const daily = dailyWeightSeries(
          weightRows.map((r) =>
            weightEntrySchema.parse({
              id: r.id,
              localDate: r.local_date,
              occurredAt: r.occurred_at,
              timezoneAtEntry: r.timezone_at_entry,
              weightKg: r.weight_kg,
              notes: r.notes,
            }),
          ),
        );
        for (const p of daily) daysWithData.add(p.localDate);
        weightDays = daily.length;
        if (weightDays > 0) {
          weightAvgKg = Number((daily.reduce((s, p) => s + p.value, 0) / weightDays).toFixed(2));
        }
      }

      let waistAvgCm: number | null = null;
      let waistDays = 0;
      if (visibility.measurements) {
        const measRows = await db.getAllAsync<{
          id: string;
          local_date: string;
          occurred_at: string;
          timezone_at_entry: string;
          metric: string;
          value_cm: number;
          notes: string;
        }>(
          "SELECT id, local_date, occurred_at, timezone_at_entry, metric, value_cm, notes FROM measurement_entries WHERE profile_id = ? AND metric = 'waist' AND local_date BETWEEN ? AND ?",
          profileId,
          startDate,
          endDate,
        );
        const dailyWaist = dailyMeasurementSeries(
          measRows.map((r) =>
            measurementEntrySchema.parse({
              id: r.id,
              localDate: r.local_date,
              occurredAt: r.occurred_at,
              timezoneAtEntry: r.timezone_at_entry,
              metric: r.metric,
              valueCm: r.value_cm,
              notes: r.notes,
            }),
          ),
          'waist',
        );
        for (const p of dailyWaist) daysWithData.add(p.localDate);
        waistDays = dailyWaist.length;
        if (waistDays > 0) {
          waistAvgCm = Number((dailyWaist.reduce((s, p) => s + p.value, 0) / waistDays).toFixed(1));
        }
      }

      let sleepAvgMinutes: number | null = null;
      let sleepDays = 0;
      if (visibility.sleep) {
        const sleepRows = await db.getAllAsync<{
          id: string;
          start_at: string;
          end_at: string;
          wake_local_date: string;
          timezone_at_entry: string;
          is_nap: number;
          quality: number | null;
          notes: string;
        }>(
          'SELECT id, start_at, end_at, wake_local_date, timezone_at_entry, is_nap, quality, notes FROM sleep_entries WHERE profile_id = ? AND wake_local_date BETWEEN ? AND ?',
          profileId,
          startDate,
          endDate,
        );
        const byDate = new Map<string, SleepEntry[]>();
        for (const r of sleepRows) {
          daysWithData.add(r.wake_local_date);
          const entry = sleepEntrySchema.parse({
            id: r.id,
            startAt: r.start_at,
            endAt: r.end_at,
            wakeLocalDate: r.wake_local_date,
            timezoneAtEntry: r.timezone_at_entry,
            isNap: r.is_nap === 1,
            quality: r.quality,
            notes: r.notes,
          });
          const list = byDate.get(entry.wakeLocalDate) ?? [];
          list.push(entry);
          byDate.set(entry.wakeLocalDate, list);
        }
        sleepDays = byDate.size;
        if (sleepDays > 0) {
          const totalMins = [...byDate.values()].reduce(
            (s, list) => s + summarizeSleepDay(list).totalMinutes,
            0,
          );
          sleepAvgMinutes = Math.round(totalMins / sleepDays);
        }
      }

      const habitLogDates = await db.getAllAsync<{ local_date: string }>(
        'SELECT DISTINCT local_date FROM habit_logs WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        profileId,
        startDate,
        endDate,
      );
      for (const r of habitLogDates) daysWithData.add(r.local_date);

      // Evita aviso de variável não usada caso weekdayOfLocalDate seja útil futuramente.
      void weekdayOfLocalDate;

      return {
        startDate,
        endDate,
        totalDays,
        daysWithAnyData: daysWithData.size,
        completedWorkouts,
        plannedWorkouts,
        cardioMinutes,
        weightAvgKg,
        weightDays,
        waistAvgCm,
        waistDays,
        waterAvgMl,
        waterDays,
        mealDays: mealDates.size,
        energyAvgKcal: energyCompleteDays > 0 ? Math.round(energySum / energyCompleteDays) : null,
        energyCompleteDays,
        proteinAvgG:
          proteinCompleteDays > 0 ? Number((proteinSum / proteinCompleteDays).toFixed(1)) : null,
        proteinCompleteDays,
        sleepAvgMinutes,
        sleepDays,
        topMealContexts: [...contextCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([context, count]) => ({ context, count })),
      };
    });
  }
}
