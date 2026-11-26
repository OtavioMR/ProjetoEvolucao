export const phase4Sql = `
CREATE TABLE reminders (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('water','meal','training','sleep','weekly_review')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  local_time TEXT NOT NULL CHECK(length(local_time) = 5 AND substr(local_time, 3, 1) = ':'),
  weekdays TEXT NOT NULL CHECK(json_valid(weekdays)),
  quiet_start TEXT CHECK(quiet_start IS NULL OR (length(quiet_start) = 5 AND substr(quiet_start, 3, 1) = ':')),
  quiet_end TEXT CHECK(quiet_end IS NULL OR (length(quiet_end) = 5 AND substr(quiet_end, 3, 1) = ':')),
  platform_notification_ids TEXT NOT NULL CHECK(json_valid(platform_notification_ids)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, category)
);
CREATE INDEX reminders_profile ON reminders(profile_id);
`;
