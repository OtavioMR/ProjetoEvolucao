import {
  buildReminderCopy,
  isWithinQuietHours,
  planReminderSchedules,
  reminderCategories,
  type Reminder,
} from './reminders';

const baseReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: '40000000-0000-4000-8000-000000000001',
  category: 'water',
  enabled: true,
  localTime: '10:00',
  weekdays: [1, 3, 5],
  quietStart: '22:30',
  quietEnd: '07:30',
  platformNotificationIds: [],
  ...overrides,
});

describe('reminders domain', () => {
  it('detecta janela de silêncio cruzando meia-noite e no mesmo dia', () => {
    expect(isWithinQuietHours('23:00', '22:30', '07:30')).toBe(true);
    expect(isWithinQuietHours('06:15', '22:30', '07:30')).toBe(true);
    expect(isWithinQuietHours('07:30', '22:30', '07:30')).toBe(false);
    expect(isWithinQuietHours('14:00', '13:00', '15:00')).toBe(true);
    expect(isWithinQuietHours('10:00', null, null)).toBe(false);
  });

  it('gera mensagens neutras sem peso, calorias ou fotos', () => {
    for (const category of reminderCategories) {
      const copy = buildReminderCopy(category);
      const joined = `${copy.title} ${copy.body}`.toLowerCase();
      expect(joined).not.toMatch(/kg|peso|kcal|caloria|foto/);
    }
  });

  it('planeja apenas ativos fora do silêncio respeitando o limite', () => {
    const list: Reminder[] = [
      baseReminder({ category: 'water', enabled: true, localTime: '10:00', weekdays: [1, 2, 3] }),
      baseReminder({ category: 'meal', enabled: false, localTime: '12:00', weekdays: [1, 2] }),
      baseReminder({ category: 'sleep', enabled: true, localTime: '23:00', weekdays: [0, 1] }),
    ];
    const planned = planReminderSchedules(list, 'America/Sao_Paulo', 2);
    expect(planned).toHaveLength(2);
    expect(planned.every((item) => item.category === 'water')).toBe(true);
    expect(planned[0]!.expoWeekday).toBe(2);
  });
});
