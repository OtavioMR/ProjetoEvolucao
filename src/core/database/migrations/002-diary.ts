// Migração aditiva. Snapshots são documentos JSON validados nas fronteiras do repositório.
const catalog = (table: string) => `
CREATE TABLE ${table} (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX ${table}_profile ON ${table}(profile_id);`;
const items = (table: string, parent: string) => `
CREATE TABLE ${table} (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT NOT NULL REFERENCES ${parent}(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  food_id TEXT REFERENCES foods(id),
  source_recipe_id TEXT REFERENCES recipes(id),
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  UNIQUE(parent_id, position), CHECK(food_id IS NULL OR source_recipe_id IS NULL)
);
CREATE INDEX ${table}_food ON ${table}(food_id);
CREATE INDEX ${table}_recipe ON ${table}(source_recipe_id);`;
export const diarySql = `
${catalog('foods')}
CREATE TABLE food_portions (
  id TEXT PRIMARY KEY NOT NULL,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id)
);
CREATE INDEX food_portions_food ON food_portions(food_id);
${catalog('recipes')}
${items('recipe_items', 'recipes')}
${catalog('meal_templates')}
${items('meal_template_items', 'meal_templates')}
CREATE TABLE meals (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  occurred_at TEXT NOT NULL,
  timezone_at_entry TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data) AND json_extract(data, '$.id') = id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX meals_profile_date ON meals(profile_id, local_date, occurred_at);
${items('meal_items', 'meals')}
CREATE TABLE water_entries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL CHECK(length(local_date) = 10 AND date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date),
  occurred_at TEXT NOT NULL, timezone_at_entry TEXT NOT NULL,
  amount_ml INTEGER NOT NULL CHECK(amount_ml > 0 AND amount_ml <= 10000),
  beverage_type TEXT NOT NULL CHECK(beverage_type IN ('water', 'other')),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX water_profile_date ON water_entries(profile_id, local_date, occurred_at);
`;
