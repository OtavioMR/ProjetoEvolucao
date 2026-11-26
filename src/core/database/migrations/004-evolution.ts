// Migração aditiva da Fase 3 (Evolução: peso, medidas, marcos, sono, hábitos e revisão semanal).
export const evolutionSql = `
CREATE TABLE weight_entries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  occurred_at TEXT NOT NULL,
  timezone_at_entry TEXT NOT NULL,
  weight_kg REAL NOT NULL CHECK(weight_kg > 0 AND weight_kg <= 500),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX weight_entries_profile_date ON weight_entries(profile_id, local_date, occurred_at);

CREATE TABLE measurement_entries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  occurred_at TEXT NOT NULL,
  timezone_at_entry TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('waist','hip','chest','left_arm','right_arm','left_thigh','right_thigh','neck')),
  value_cm REAL NOT NULL CHECK(value_cm > 0 AND value_cm <= 400),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX measurement_entries_profile_metric_date ON measurement_entries(profile_id, metric, local_date, occurred_at);

CREATE TABLE body_milestones (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 80),
  target_weight_kg REAL NOT NULL CHECK(target_weight_kg > 0 AND target_weight_kg <= 500),
  achieved_at TEXT,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX body_milestones_profile ON body_milestones(profile_id, target_weight_kg);

CREATE TABLE sleep_entries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL CHECK(end_at > start_at),
  wake_local_date TEXT NOT NULL CHECK(length(wake_local_date) = 10 AND date(wake_local_date, '+0 days') IS NOT NULL AND date(wake_local_date, '+0 days') = wake_local_date),
  timezone_at_entry TEXT NOT NULL,
  is_nap INTEGER NOT NULL CHECK(is_nap IN (0, 1)),
  quality INTEGER CHECK(quality IS NULL OR (quality BETWEEN 1 AND 5 AND typeof(quality) = 'integer')),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX sleep_entries_profile_wake ON sleep_entries(profile_id, wake_local_date, start_at);

CREATE TABLE habits (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX habits_profile ON habits(profile_id);

CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  status TEXT NOT NULL CHECK(status IN ('done', 'not_done', 'not_applicable')),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(habit_id, local_date)
);
CREATE INDEX habit_logs_profile_date ON habit_logs(profile_id, local_date);

CREATE TABLE weekly_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  week_start_date TEXT NOT NULL CHECK(length(week_start_date) = 10 AND date(week_start_date, '+0 days') IS NOT NULL AND date(week_start_date, '+0 days') = week_start_date),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, week_start_date)
);
CREATE INDEX weekly_reviews_profile_week ON weekly_reviews(profile_id, week_start_date);
`;
