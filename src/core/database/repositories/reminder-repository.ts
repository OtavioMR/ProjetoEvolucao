import {
  reminderInputSchema,
  reminderSchema,
  type Reminder,
  type ReminderCategory,
  type ReminderInput,
} from '../../../domain/reminders/reminders.ts';
import { DatabaseQueue } from '../connection.ts';

type ReminderRow = {
  id: string;
  profile_id: string;
  category: ReminderCategory;
  enabled: number;
  local_time: string;
  weekdays: string;
  quiet_start: string | null;
  quiet_end: string | null;
  platform_notification_ids: string;
};

function mapRow(row: ReminderRow): Reminder {
  return reminderSchema.parse({
    id: row.id,
    category: row.category,
    enabled: row.enabled === 1,
    localTime: row.local_time,
    weekdays: JSON.parse(row.weekdays),
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    platformNotificationIds: JSON.parse(row.platform_notification_ids),
  });
}

export class ReminderRepository {
  private readonly queue: DatabaseQueue;
  private readonly newId: () => string;

  constructor(queue: DatabaseQueue, newId: () => string) {
    this.queue = queue;
    this.newId = newId;
  }

  list(profileId: string): Promise<Reminder[]> {
    return this.queue.run(async (db) => {
      const rows = await db.getAllAsync<ReminderRow>(
        'SELECT * FROM reminders WHERE profile_id = ? ORDER BY category',
        profileId,
      );
      return rows.map(mapRow);
    });
  }

  upsert(profileId: string, input: ReminderInput): Promise<Reminder> {
    const valid = reminderInputSchema.parse(input);
    const uniqueWeekdays = [...new Set(valid.weekdays)].sort((a, b) => a - b);
    const now = new Date().toISOString();
    return this.queue.transaction(async (db) => {
      const existing = await db.getFirstAsync<ReminderRow>(
        'SELECT * FROM reminders WHERE profile_id = ? AND category = ?',
        profileId,
        valid.category,
      );
      if (existing) {
        await db.runAsync(
          `UPDATE reminders
           SET enabled = ?, local_time = ?, weekdays = ?, quiet_start = ?, quiet_end = ?, updated_at = ?
           WHERE id = ?`,
          valid.enabled ? 1 : 0,
          valid.localTime,
          JSON.stringify(uniqueWeekdays),
          valid.quietStart,
          valid.quietEnd,
          now,
          existing.id,
        );
        return mapRow({
          ...existing,
          enabled: valid.enabled ? 1 : 0,
          local_time: valid.localTime,
          weekdays: JSON.stringify(uniqueWeekdays),
          quiet_start: valid.quietStart,
          quiet_end: valid.quietEnd,
        });
      }
      const id = this.newId();
      await db.runAsync(
        `INSERT INTO reminders
         (id, profile_id, category, enabled, local_time, weekdays, quiet_start, quiet_end, platform_notification_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        profileId,
        valid.category,
        valid.enabled ? 1 : 0,
        valid.localTime,
        JSON.stringify(uniqueWeekdays),
        valid.quietStart,
        valid.quietEnd,
        '[]',
        now,
        now,
      );
      return reminderSchema.parse({
        id,
        ...valid,
        weekdays: uniqueWeekdays,
        platformNotificationIds: [],
      });
    });
  }

  updateNotificationIds(id: string, ids: string[]): Promise<void> {
    const now = new Date().toISOString();
    return this.queue.run(async (db) => {
      await db.runAsync(
        'UPDATE reminders SET platform_notification_ids = ?, updated_at = ? WHERE id = ?',
        JSON.stringify(ids),
        now,
        id,
      );
    });
  }
}
