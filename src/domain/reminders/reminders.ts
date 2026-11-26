import { z } from 'zod';
import { isTimezone } from '../../core/date-time/local-date.ts';
import { timeSchema } from '../profile/profile.ts';

export const reminderCategories = ['water', 'meal', 'training', 'sleep', 'weekly_review'] as const;
export type ReminderCategory = (typeof reminderCategories)[number];

export const reminderCategorySchema = z.enum(reminderCategories);

export const reminderSchema = z.object({
  id: z.uuid(),
  category: reminderCategorySchema,
  enabled: z.boolean(),
  localTime: timeSchema,
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  quietStart: timeSchema.nullable(),
  quietEnd: timeSchema.nullable(),
  platformNotificationIds: z.array(z.string().min(1)).max(32),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const reminderInputSchema = reminderSchema.omit({
  id: true,
  platformNotificationIds: true,
});
export type ReminderInput = z.infer<typeof reminderInputSchema>;

export const maxScheduledNotifications = 21;

export const reminderCategoryLabels: Record<ReminderCategory, string> = {
  water: 'Hidratação',
  meal: 'Refeições',
  training: 'Treino',
  sleep: 'Sono',
  weekly_review: 'Revisão semanal',
};

export function defaultReminderInputs(): ReminderInput[] {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  return [
    {
      category: 'water',
      enabled: false,
      localTime: '10:00',
      weekdays: allDays,
      quietStart: '22:30',
      quietEnd: '07:30',
    },
    {
      category: 'meal',
      enabled: false,
      localTime: '12:00',
      weekdays: allDays,
      quietStart: '22:30',
      quietEnd: '07:30',
    },
    {
      category: 'training',
      enabled: false,
      localTime: '10:00',
      weekdays: [1, 3, 5],
      quietStart: '22:30',
      quietEnd: '07:30',
    },
    {
      category: 'sleep',
      enabled: false,
      localTime: '22:00',
      weekdays: allDays,
      quietStart: '22:30',
      quietEnd: '07:30',
    },
    {
      category: 'weekly_review',
      enabled: false,
      localTime: '19:00',
      weekdays: [0],
      quietStart: '22:30',
      quietEnd: '07:30',
    },
  ];
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

export function isWithinQuietHours(
  localTime: string,
  quietStart: string | null,
  quietEnd: string | null,
): boolean {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;
  const target = toMinutes(localTime);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start < end) return target >= start && target < end;
  return target >= start || target < end;
}

/** Linguagem neutra: nunca inclui peso, calorias ou fotos. */
export function buildReminderCopy(category: ReminderCategory): { title: string; body: string } {
  switch (category) {
    case 'water':
      return {
        title: 'Evolução · Hidratação',
        body: 'Lembrete opcional para registrar água quando fizer sentido.',
      };
    case 'meal':
      return {
        title: 'Evolução · Diário alimentar',
        body: 'Lembrete opcional para anotar sua refeição.',
      };
    case 'training':
      return {
        title: 'Evolução · Treino',
        body: 'Confira seu planejamento de treino ou descanso para hoje.',
      };
    case 'sleep':
      return {
        title: 'Evolução · Sono',
        body: 'Momento sugerido para desacelerar e registrar seu descanso.',
      };
    case 'weekly_review':
      return {
        title: 'Evolução · Revisão semanal',
        body: 'Sua revisão semanal está disponível para anotações.',
      };
  }
}

export type PlannedNotification = {
  category: ReminderCategory;
  weekday: number;
  expoWeekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

export function planReminderSchedules(
  reminders: readonly Reminder[],
  timezone: string,
  limit = maxScheduledNotifications,
): PlannedNotification[] {
  if (!isTimezone(timezone)) throw new Error('Fuso horário inválido para lembretes.');
  const planned: PlannedNotification[] = [];
  for (const reminder of reminders) {
    if (!reminder.enabled || reminder.weekdays.length === 0) continue;
    if (isWithinQuietHours(reminder.localTime, reminder.quietStart, reminder.quietEnd)) continue;
    const [hour, minute] = reminder.localTime.split(':').map(Number) as [number, number];
    const copy = buildReminderCopy(reminder.category);
    const uniqueDays = [...new Set(reminder.weekdays)].sort((a, b) => a - b);
    for (const weekday of uniqueDays) {
      if (planned.length >= limit) return planned;
      planned.push({
        category: reminder.category,
        weekday,
        expoWeekday: weekday + 1,
        hour,
        minute,
        title: copy.title,
        body: copy.body,
      });
    }
  }
  return planned;
}
