export const foundationSql = `
CREATE TABLE profile (
  id TEXT PRIMARY KEY NOT NULL,
  singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK(singleton = 1),
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 80),
  age_at_setup INTEGER CHECK(age_at_setup IS NULL OR (age_at_setup >= 0 AND typeof(age_at_setup) = 'integer')),
  height_cm REAL CHECK(height_cm IS NULL OR height_cm > 0),
  reference_weight_kg REAL CHECK(reference_weight_kg IS NULL OR reference_weight_kg > 0),
  target_weight_kg REAL CHECK(target_weight_kg IS NULL OR target_weight_kg > 0),
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE preferences (
  profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  theme TEXT NOT NULL CHECK(theme IN ('dark', 'light', 'system')),
  locale TEXT NOT NULL CHECK(locale = 'pt-BR'),
  feature_visibility TEXT NOT NULL CHECK(json_valid(feature_visibility)),
  quick_water_amounts TEXT NOT NULL CHECK(json_valid(quick_water_amounts)),
  meal_preferences TEXT NOT NULL CHECK(json_valid(meal_preferences)),
  available_days TEXT NOT NULL CHECK(json_valid(available_days)),
  week_start INTEGER NOT NULL CHECK(week_start IN (0,1)),
  training_time TEXT NOT NULL,
  sleep_start TEXT NOT NULL,
  sleep_end TEXT NOT NULL,
  reminders_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminders_enabled = 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE goal_versions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK(metric IN ('water','energy','protein','carbs','fat','sleep','cardio')),
  target_value REAL NOT NULL CHECK(target_value > 0),
  unit TEXT NOT NULL CHECK(
    (metric = 'water' AND unit = 'mL') OR (metric = 'energy' AND unit = 'kcal') OR
    (metric IN ('protein','carbs','fat') AND unit = 'g') OR
    (metric = 'sleep' AND unit = 'hours') OR (metric = 'cardio' AND unit = 'minutes')),
  effective_from_date TEXT NOT NULL CHECK(length(effective_from_date) = 10 AND date(effective_from_date) IS NOT NULL AND date(effective_from_date) = effective_from_date),
  effective_to_date TEXT CHECK(effective_to_date IS NULL OR
    (length(effective_to_date) = 10 AND date(effective_to_date) IS NOT NULL AND date(effective_to_date) = effective_to_date AND effective_to_date >= effective_from_date)),
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX goal_versions_lookup ON goal_versions(profile_id, metric, effective_from_date);
CREATE TRIGGER goal_no_overlap_insert BEFORE INSERT ON goal_versions
WHEN EXISTS (SELECT 1 FROM goal_versions g WHERE g.profile_id = NEW.profile_id AND g.metric = NEW.metric
 AND g.effective_from_date <= COALESCE(NEW.effective_to_date, '9999-12-31')
 AND COALESCE(g.effective_to_date, '9999-12-31') >= NEW.effective_from_date)
BEGIN SELECT RAISE(ABORT, 'goal_overlap'); END;
CREATE TRIGGER goal_no_overlap_update BEFORE UPDATE ON goal_versions
WHEN EXISTS (SELECT 1 FROM goal_versions g WHERE g.id <> NEW.id AND g.profile_id = NEW.profile_id AND g.metric = NEW.metric
 AND g.effective_from_date <= COALESCE(NEW.effective_to_date, '9999-12-31')
 AND COALESCE(g.effective_to_date, '9999-12-31') >= NEW.effective_from_date)
BEGIN SELECT RAISE(ABORT, 'goal_overlap'); END;
`;
