import { validateBackup, type Backup } from '../domain/backup/backup';
import { syntheticSetup } from './fixtures';

/** Fixture sintética, sem qualquer banco ou dado do aplicativo. */
export function syntheticBackup(): Backup {
  const setup = syntheticSetup();
  const id = '30000000-0000-4000-8000-000000000001';
  const meta = { created_at: '2026-04-08T02:50:00.000Z', updated_at: '2026-04-08T02:50:00.000Z' };
  return validateBackup({
    format: 'evolucao-local',
    formatVersion: 1,
    schemaVersion: 2,
    exportedAt: meta.created_at,
    tables: {
      profile: [
        {
          id,
          singleton: 1,
          display_name: setup.profile.displayName,
          age_at_setup: null,
          height_cm: null,
          reference_weight_kg: null,
          target_weight_kg: null,
          timezone: setup.profile.timezone,
          ...meta,
        },
      ],
      preferences: [
        {
          profile_id: id,
          theme: 'dark',
          locale: 'pt-BR',
          feature_visibility: JSON.stringify(setup.preferences.visibility),
          quick_water_amounts: '[250,500]',
          meal_preferences: JSON.stringify(setup.preferences.meals),
          available_days: '[1,3,5]',
          week_start: 1,
          training_time: '10:00',
          sleep_start: '00:30',
          sleep_end: '08:30',
          reminders_enabled: 0,
          ...meta,
        },
      ],
      goal_versions: [],
      foods: [],
      food_portions: [],
      recipes: [],
      recipe_items: [],
      meal_templates: [],
      meal_template_items: [],
      meals: [],
      meal_items: [],
      water_entries: [],
    },
  });
}
