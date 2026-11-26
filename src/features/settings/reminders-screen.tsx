import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  requestReminderPermission,
  syncScheduledReminders,
} from '../../core/notifications/reminder-scheduler';
import {
  defaultReminderInputs,
  reminderCategories,
  reminderCategoryLabels,
  reminderInputSchema,
  type ReminderCategory,
  type ReminderInput,
} from '../../domain/reminders/reminders';
import { useApp } from '../../shared/app-provider';
import {
  Button,
  Card,
  Field,
  Header,
  Notice,
  Screen,
  Toggle,
  Txt,
} from '../../shared/components/ui';
import { useAction } from '../diary/use-diary';

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function RemindersScreen() {
  const { snapshot, reminders: reminderRepo } = useApp();
  const [items, setItems] = useState<Record<ReminderCategory, ReminderInput>>(() => {
    const map = {} as Record<ReminderCategory, ReminderInput>;
    for (const def of defaultReminderInputs()) map[def.category] = def;
    return map;
  });
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const action = useAction();

  const profileId = snapshot?.profile.id;
  useEffect(() => {
    if (!reminderRepo || !profileId) return;
    let cancelled = false;
    void reminderRepo.list(profileId).then((saved) => {
      if (cancelled) return;
      setItems((prev) => {
        const next = { ...prev };
        for (const row of saved) {
          next[row.category] = {
            category: row.category,
            enabled: row.enabled,
            localTime: row.localTime,
            weekdays: row.weekdays,
            quietStart: row.quietStart,
            quietEnd: row.quietEnd,
          };
        }
        return next;
      });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reminderRepo, profileId]);

  function updateItem(category: ReminderCategory, patch: Partial<ReminderInput>) {
    setItems((prev) => ({
      ...prev,
      [category]: { ...prev[category], ...patch },
    }));
  }

  function toggleWeekday(category: ReminderCategory, day: number) {
    const current = items[category].weekdays;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    updateItem(category, { weekdays: next });
  }

  async function saveAll() {
    if (!reminderRepo || !snapshot) return;
    const list = reminderCategories.map((cat) => reminderInputSchema.parse(items[cat]));
    const anyEnabled = list.some((item) => item.enabled);
    if (anyEnabled) {
      const granted = await requestReminderPermission();
      setPermissionDenied(!granted);
      if (!granted) {
        for (const item of list) {
          await reminderRepo.upsert(snapshot.profile.id, { ...item, enabled: false });
        }
        await syncScheduledReminders(reminderRepo, snapshot.profile.id, snapshot.profile.timezone);
        setItems((prev) => {
          const next = { ...prev };
          for (const item of list) next[item.category] = { ...item, enabled: false };
          return next;
        });
        return;
      }
    } else {
      setPermissionDenied(false);
    }

    for (const item of list) {
      await reminderRepo.upsert(snapshot.profile.id, item);
    }
    const result = await syncScheduledReminders(
      reminderRepo,
      snapshot.profile.id,
      snapshot.profile.timezone,
    );
    if (!result.permissionGranted && anyEnabled) {
      setPermissionDenied(true);
    }
  }

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Configurações / Lembretes"
        title="Lembretes locais opcionais."
        description="Desativados por padrão. Mensagens neutras, sem exibir peso, calorias ou fotos."
      />
      <Notice>
        A permissão do sistema só é solicitada quando você ativa ao menos uma categoria. Se for
        recusada, o aplicativo continua funcionando normalmente.
      </Notice>
      {permissionDenied ? (
        <Notice error>
          Permissão de notificações não concedida neste dispositivo. Os lembretes permaneceram
          desativados; você pode liberar nas configurações do sistema quando quiser.
        </Notice>
      ) : null}
      {reminderCategories.map((category) => {
        const item = items[category];
        return (
          <Card key={category}>
            <Toggle
              title={reminderCategoryLabels[category]}
              detail="Notificação local semanal no horário escolhido"
              value={item.enabled}
              onChange={(enabled) => updateItem(category, { enabled })}
            />
            {item.enabled ? (
              <View style={{ gap: 12 }}>
                <Field
                  label={`Horário (${reminderCategoryLabels[category]})`}
                  value={item.localTime}
                  onChangeText={(localTime) => updateItem(category, { localTime })}
                  placeholder="HH:mm"
                />
                <View style={{ gap: 6 }}>
                  <Txt kind="label">Dias da semana</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {weekdayLabels.map((label, day) => {
                      const active = item.weekdays.includes(day);
                      return (
                        <Button
                          key={day}
                          compact
                          secondary={!active}
                          title={label}
                          accessibilityLabel={`${reminderCategoryLabels[category]} ${label}`}
                          onPress={() => toggleWeekday(category, day)}
                        />
                      );
                    })}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Silêncio início"
                      value={item.quietStart ?? ''}
                      onChangeText={(v) => updateItem(category, { quietStart: v.trim() || null })}
                      placeholder="22:30"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Silêncio fim"
                      value={item.quietEnd ?? ''}
                      onChangeText={(v) => updateItem(category, { quietEnd: v.trim() || null })}
                      placeholder="07:30"
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      <Button
        title="Salvar lembretes"
        busy={action.busy || !loaded}
        icon="notifications-outline"
        onPress={() =>
          void action.run(saveAll, 'Preferências de lembretes atualizadas neste dispositivo.')
        }
      />
    </Screen>
  );
}
