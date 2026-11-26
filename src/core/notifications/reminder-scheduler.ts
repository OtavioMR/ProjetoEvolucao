import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planReminderSchedules, type ReminderCategory } from '../../domain/reminders/reminders';
import { ReminderRepository } from '../database/repositories/reminder-repository';

export async function hasReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || current.status === 'granted';
  } catch {
    return false;
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted || requested.status === 'granted';
  } catch {
    return false;
  }
}

export async function cancelAllScheduledReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Sem falha fatal caso o ambiente não suporte notificações nativas.
  }
}

export async function syncScheduledReminders(
  repo: ReminderRepository,
  profileId: string,
  timezone: string,
): Promise<{ permissionGranted: boolean; scheduledCount: number }> {
  const reminders = await repo.list(profileId);
  for (const reminder of reminders) {
    for (const id of reminder.platformNotificationIds) {
      if (Platform.OS !== 'web') {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
      }
    }
    if (reminder.platformNotificationIds.length > 0) {
      await repo.updateNotificationIds(reminder.id, []);
    }
  }

  const anyEnabled = reminders.some((item) => item.enabled);
  if (!anyEnabled) {
    return { permissionGranted: true, scheduledCount: 0 };
  }
  if (Platform.OS === 'web') {
    return { permissionGranted: false, scheduledCount: 0 };
  }
  const granted = await hasReminderPermission();
  if (!granted) {
    return { permissionGranted: false, scheduledCount: 0 };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Lembretes locais',
      importance: 3 as Notifications.AndroidImportance,
    }).catch(() => undefined);
  }

  const planned = planReminderSchedules(reminders, timezone);
  const idsByCategory = new Map<ReminderCategory, string[]>();
  let scheduledCount = 0;

  for (const item of planned) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
        weekday: item.expoWeekday,
        hour: item.hour,
        minute: item.minute,
      },
    });
    const list = idsByCategory.get(item.category) ?? [];
    list.push(id);
    idsByCategory.set(item.category, list);
    scheduledCount += 1;
  }

  for (const reminder of reminders) {
    const ids = idsByCategory.get(reminder.category) ?? [];
    if (ids.length > 0) {
      await repo.updateNotificationIds(reminder.id, ids);
    }
  }

  return { permissionGranted: true, scheduledCount };
}
