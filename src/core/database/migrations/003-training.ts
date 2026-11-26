// Migração aditiva da Fase 2 (Treinos e Cardio).
export const trainingSql = `
CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX exercises_profile ON exercises(profile_id);

CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX workout_templates_profile ON workout_templates(profile_id);

CREATE TABLE workout_template_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  UNIQUE(parent_id, position)
);
CREATE INDEX workout_template_exercises_exercise ON workout_template_exercises(exercise_id);

CREATE TABLE training_plan_versions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  effective_from_date TEXT NOT NULL CHECK(length(effective_from_date) = 10 AND date(effective_from_date, '+0 days') IS NOT NULL AND date(effective_from_date, '+0 days') = effective_from_date),
  effective_to_date TEXT CHECK(effective_to_date IS NULL OR (length(effective_to_date) = 10 AND date(effective_to_date, '+0 days') IS NOT NULL AND date(effective_to_date, '+0 days') = effective_to_date AND effective_to_date >= effective_from_date)),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX training_plan_profile_dates ON training_plan_versions(profile_id, effective_from_date);
CREATE TRIGGER training_plan_no_overlap_insert BEFORE INSERT ON training_plan_versions
WHEN EXISTS (
  SELECT 1 FROM training_plan_versions p
  WHERE p.profile_id = NEW.profile_id
    AND p.effective_from_date <= COALESCE(NEW.effective_to_date, '9999-12-31')
    AND COALESCE(p.effective_to_date, '9999-12-31') >= NEW.effective_from_date
)
BEGIN SELECT RAISE(ABORT, 'training_plan_overlap'); END;
CREATE TRIGGER training_plan_no_overlap_update BEFORE UPDATE ON training_plan_versions
WHEN EXISTS (
  SELECT 1 FROM training_plan_versions p
  WHERE p.id <> NEW.id AND p.profile_id = NEW.profile_id
    AND p.effective_from_date <= COALESCE(NEW.effective_to_date, '9999-12-31')
    AND COALESCE(p.effective_to_date, '9999-12-31') >= NEW.effective_from_date
)
BEGIN SELECT RAISE(ABORT, 'training_plan_overlap'); END;

CREATE TABLE training_day_overrides (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('rest', 'swap')),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, local_date)
);
CREATE INDEX training_day_overrides_template ON training_day_overrides(template_id);

CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  timezone_at_entry TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled')),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX workout_sessions_profile_date ON workout_sessions(profile_id, local_date, started_at);
CREATE INDEX workout_sessions_template ON workout_sessions(template_id);
CREATE UNIQUE INDEX workout_sessions_one_active ON workout_sessions(profile_id) WHERE status = 'active';

CREATE TABLE workout_session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  UNIQUE(session_id, position)
);
CREATE INDEX workout_session_exercises_exercise ON workout_session_exercises(exercise_id);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_exercise_id TEXT NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  UNIQUE(session_exercise_id, position)
);

CREATE TABLE cardio_entries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES workout_sessions(id) ON DELETE SET NULL,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  occurred_at TEXT NOT NULL,
  timezone_at_entry TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0 AND duration_minutes <= 1440),
  distance_km REAL CHECK(distance_km IS NULL OR (distance_km > 0 AND distance_km <= 500)),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX cardio_profile_date ON cardio_entries(profile_id, local_date, occurred_at);
CREATE INDEX cardio_session ON cardio_entries(session_id);
`;
