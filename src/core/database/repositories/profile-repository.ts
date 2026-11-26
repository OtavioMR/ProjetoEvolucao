import { shiftDate } from '../../date-time/event-time.ts';
import { isLocalDate, localDateAt } from '../../date-time/local-date.ts';
import { DatabaseQueue, type SqlConnection } from '../connection.ts';
import {
  goalSchema,
  goalUnits,
  preferencesSchema,
  profileSchema,
  setupSchema,
  type AppSnapshot,
  type GoalMetric,
  type Preferences,
  type ProfileInput,
  type SetupInput,
} from '../../../domain/profile/profile.ts';

type ProfileRow = {
  id: string;
  display_name: string;
  age_at_setup: number | null;
  height_cm: number | null;
  reference_weight_kg: number | null;
  target_weight_kg: number | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};
type PreferencesRow = {
  theme: string;
  locale: string;
  feature_visibility: string;
  quick_water_amounts: string;
  meal_preferences: string;
  available_days: string;
  week_start: number;
  training_time: string;
  sleep_start: string;
  sleep_end: string;
};
type GoalRow = {
  id: string;
  profile_id: string;
  metric: string;
  target_value: number;
  unit: string;
  effective_from_date: string;
  effective_to_date: string | null;
  enabled: number;
};

export class ProfileRepository {
  private readonly queue: DatabaseQueue;
  private readonly uuid: () => string;
  private readonly now: () => Date;
  constructor(queue: DatabaseQueue, uuid: () => string, now: () => Date = () => new Date()) {
    this.queue = queue;
    this.uuid = uuid;
    this.now = now;
  }

  read(): Promise<AppSnapshot | null> {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE singleton = 1');
      if (!row) return null;
      const p = await db.getFirstAsync<PreferencesRow>(
        'SELECT * FROM preferences WHERE profile_id = ?',
        row.id,
      );
      if (!p) throw new Error('missing_preferences');
      const profile = profileSchema.parse({
        displayName: row.display_name,
        ageAtSetup: row.age_at_setup,
        heightCm: row.height_cm,
        referenceWeightKg: row.reference_weight_kg,
        targetWeightKg: row.target_weight_kg,
        timezone: row.timezone,
      });
      const preferences = preferencesSchema.parse({
        theme: p.theme,
        locale: p.locale,
        visibility: JSON.parse(p.feature_visibility),
        quickWaterAmounts: JSON.parse(p.quick_water_amounts),
        meals: JSON.parse(p.meal_preferences),
        availableDays: JSON.parse(p.available_days),
        weekStart: p.week_start,
        trainingTime: p.training_time,
        sleepStart: p.sleep_start,
        sleepEnd: p.sleep_end,
      });
      const rows = await db.getAllAsync<GoalRow>(
        'SELECT * FROM goal_versions WHERE profile_id = ? ORDER BY metric, effective_from_date',
        row.id,
      );
      const goals = rows.map((g) =>
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
      return {
        profile: { ...profile, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at },
        preferences,
        goals,
      };
    });
  }

  async create(input: SetupInput): Promise<void> {
    const data = setupSchema.parse(input);
    const id = this.uuid();
    const instant = this.now();
    const timestamp = instant.toISOString();
    await this.queue.transaction(async (db) => {
      const p = data.profile;
      await db.runAsync(
        'INSERT INTO profile(id, display_name, age_at_setup, height_cm, reference_weight_kg, target_weight_kg, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        p.displayName,
        p.ageAtSetup,
        p.heightCm,
        p.referenceWeightKg,
        p.targetWeightKg,
        p.timezone,
        timestamp,
        timestamp,
      );
      await this.writePreferences(db, id, data.preferences, timestamp, true);
      for (const [key, value] of Object.entries(data.goals)) {
        if (value === null) continue;
        const metric = key as GoalMetric;
        await db.runAsync(
          'INSERT INTO goal_versions(id, profile_id, metric, target_value, unit, effective_from_date, effective_to_date, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)',
          this.uuid(),
          id,
          metric,
          value,
          goalUnits[metric],
          localDateAt(instant, p.timezone),
          timestamp,
          timestamp,
        );
      }
    });
  }

  async updateProfile(id: string, input: ProfileInput): Promise<void> {
    const p = profileSchema.parse(input);
    await this.queue.transaction(async (db) => {
      const result = await db.runAsync(
        'UPDATE profile SET display_name = ?, age_at_setup = ?, height_cm = ?, reference_weight_kg = ?, target_weight_kg = ?, timezone = ?, updated_at = ? WHERE id = ?',
        p.displayName,
        p.ageAtSetup,
        p.heightCm,
        p.referenceWeightKg,
        p.targetWeightKg,
        p.timezone,
        this.now().toISOString(),
        id,
      );
      if (result.changes !== 1) throw new Error('profile_not_found');
    });
  }

  async updatePreferences(id: string, input: Preferences): Promise<void> {
    const p = preferencesSchema.parse(input);
    await this.queue.transaction((db) =>
      this.writePreferences(db, id, p, this.now().toISOString(), false),
    );
  }

  /**
   * Cria ou atualiza uma meta a partir de effectiveFromDate, encerrando a versão anterior na véspera
   * para preservar o histórico e manter a restrição de não sobreposição do banco.
   */
  async upsertGoalVersion(
    profileId: string,
    metric: GoalMetric,
    targetValue: number,
    effectiveFromDate: string,
    enabled: boolean,
  ): Promise<void> {
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      throw new Error('Valor da meta deve ser positivo.');
    }
    if (!isLocalDate(effectiveFromDate)) {
      throw new Error('Data de vigência inválida.');
    }
    const timestamp = this.now().toISOString();
    const prevDay = shiftDate(effectiveFromDate, -1);
    await this.queue.transaction(async (db) => {
      const sameDay = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM goal_versions WHERE profile_id = ? AND metric = ? AND effective_from_date = ?',
        profileId,
        metric,
        effectiveFromDate,
      );
      if (sameDay) {
        await db.runAsync(
          'UPDATE goal_versions SET target_value = ?, enabled = ?, updated_at = ? WHERE id = ?',
          targetValue,
          enabled ? 1 : 0,
          timestamp,
          sameDay.id,
        );
        return;
      }
      const previous = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM goal_versions WHERE profile_id = ? AND metric = ? AND effective_from_date < ? AND (effective_to_date IS NULL OR effective_to_date >= ?)',
        profileId,
        metric,
        effectiveFromDate,
        effectiveFromDate,
      );
      if (previous) {
        await db.runAsync(
          'UPDATE goal_versions SET effective_to_date = ?, updated_at = ? WHERE id = ?',
          prevDay,
          timestamp,
          previous.id,
        );
      }
      await db.runAsync(
        'INSERT INTO goal_versions(id, profile_id, metric, target_value, unit, effective_from_date, effective_to_date, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)',
        this.uuid(),
        profileId,
        metric,
        targetValue,
        goalUnits[metric],
        effectiveFromDate,
        enabled ? 1 : 0,
        timestamp,
        timestamp,
      );
    });
  }

  private async writePreferences(
    db: SqlConnection,
    id: string,
    p: Preferences,
    timestamp: string,
    insert: boolean,
  ): Promise<void> {
    const values = [
      p.theme,
      p.locale,
      JSON.stringify(p.visibility),
      JSON.stringify(p.quickWaterAmounts),
      JSON.stringify(p.meals),
      JSON.stringify(p.availableDays),
      p.weekStart,
      p.trainingTime,
      p.sleepStart,
      p.sleepEnd,
    ];
    if (insert) {
      await db.runAsync(
        'INSERT INTO preferences(theme, locale, feature_visibility, quick_water_amounts, meal_preferences, available_days, week_start, training_time, sleep_start, sleep_end, profile_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ...values,
        id,
        timestamp,
        timestamp,
      );
    } else {
      const result = await db.runAsync(
        'UPDATE preferences SET theme = ?, locale = ?, feature_visibility = ?, quick_water_amounts = ?, meal_preferences = ?, available_days = ?, week_start = ?, training_time = ?, sleep_start = ?, sleep_end = ?, updated_at = ? WHERE profile_id = ?',
        ...values,
        timestamp,
        id,
      );
      if (result.changes !== 1) throw new Error('preferences_not_found');
    }
  }
}
