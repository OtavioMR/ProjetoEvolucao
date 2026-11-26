import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';

import {
  habitStateForDate,
  habitSuggestions,
  weekdayOfLocalDate,
  type Habit,
  type HabitDayState,
} from '../../domain/evolution/evolution';
import {
  Button,
  Card,
  CompactRow,
  Field,
  Header,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import { DateSelector, LoadState } from '../diary/components';
import { useEvolution } from './use-evolution';

const stateItems: { value: HabitDayState; label: string }[] = [
  { value: 'unrecorded', label: 'Sem reg.' },
  { value: 'done', label: 'Feito' },
  { value: 'not_done', label: 'Não feito' },
  { value: 'not_applicable', label: 'N/A' },
];

export function HabitsScreen() {
  const { snapshot, evolution, data, selectedDate, recordsChanged, error, retry } = useEvolution();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!snapshot) return null;
  const dayWeekday = weekdayOfLocalDate(selectedDate);
  const activeHabits = data ? data.habits.filter((h) => !h.archivedAt) : [];
  const archivedHabits = data ? data.habits.filter((h) => Boolean(h.archivedAt)) : [];

  const handleLoadSuggestions = async () => {
    if (!evolution || busy) return;
    setBusy(true);
    try {
      const suggestions = habitSuggestions();
      await evolution.saveHabitsBatch(
        snapshot.profile.id,
        suggestions.map((s, idx) => ({
          id: randomUUID(),
          title: s.title,
          description: s.description,
          weekdays: s.weekdays,
          position: activeHabits.length + idx,
          archivedAt: null,
        })),
      );
      recordsChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleAddHabit = async () => {
    if (!evolution || busy) return;
    if (!title.trim()) {
      setFeedback('Informe o nome do hábito.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const habit: Habit = {
        id: randomUUID(),
        title: title.trim(),
        description: description.trim(),
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        position: data?.habits.length ?? 0,
        archivedAt: null,
      };
      await evolution.saveHabit(snapshot.profile.id, habit);
      setTitle('');
      setDescription('');
      recordsChanged();
      setFeedback('Hábito criado.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetState = async (habitId: string, nextState: HabitDayState) => {
    if (!evolution || busy) return;
    setBusy(true);
    try {
      if (nextState === 'unrecorded') {
        await evolution.clearHabitLog(habitId, selectedDate);
      } else {
        await evolution.upsertHabitLog(snapshot.profile.id, {
          id: randomUUID(),
          habitId,
          localDate: selectedDate,
          status: nextState,
          notes: '',
        });
      }
      recordsChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleArchive = async (habit: Habit) => {
    if (!evolution || busy) return;
    setBusy(true);
    try {
      await evolution.saveHabit(snapshot.profile.id, {
        ...habit,
        archivedAt: habit.archivedAt ? null : new Date().toISOString(),
      });
      recordsChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Hábitos"
        title="Rotina sem culpa."
        description="Quatro estados explícitos por dia. Arquivar preserva todo o histórico."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          {activeHabits.length === 0 ? (
            <Card>
              <Txt kind="heading">Nenhum hábito ativo</Txt>
              <Txt kind="muted">
                Você pode carregar sugestões iniciais ou cadastrar hábitos próprios abaixo.
              </Txt>
              <Button
                secondary
                title="Carregar hábitos sugeridos"
                busy={busy}
                onPress={() => void handleLoadSuggestions()}
              />
            </Card>
          ) : (
            activeHabits.map((habit) => {
              const log = data.dayHabitLogs.find((l) => l.habitId === habit.id);
              const state = habitStateForDate(log);
              const scheduledToday = habit.weekdays.includes(dayWeekday);
              return (
                <Card key={habit.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Txt kind="heading">{habit.title}</Txt>
                      {habit.description ? <Txt kind="muted">{habit.description}</Txt> : null}
                      {!scheduledToday ? (
                        <Txt kind="muted">Fora dos dias programados habituais</Txt>
                      ) : null}
                    </View>
                    <Button
                      secondary
                      title="Arquivar"
                      onPress={() => void handleToggleArchive(habit)}
                    />
                  </View>
                  <SegmentedControl
                    options={stateItems}
                    value={state}
                    onChange={(v) => void handleSetState(habit.id, v as HabitDayState)}
                  />
                </Card>
              );
            })
          )}

          <Card>
            <Txt kind="heading">Novo hábito</Txt>
            <Field
              label="Nome do hábito"
              value={title}
              onChangeText={setTitle}
              placeholder="Ex.: Leitura ou caminhada leve"
            />
            <Field
              label="Descrição (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Ex.: 15 minutos após o almoço"
            />
            {feedback ? <Notice>{feedback}</Notice> : null}
            <Button title="Adicionar hábito" busy={busy} onPress={() => void handleAddHabit()} />
          </Card>

          {archivedHabits.length > 0 ? (
            <Card>
              <Txt kind="eyebrow">Arquivados (histórico preservado)</Txt>
              {archivedHabits.map((habit) => (
                <CompactRow
                  key={habit.id}
                  title={habit.title}
                  subtitle="Arquivado"
                  right={
                    <Button
                      secondary
                      title="Reativar"
                      onPress={() => void handleToggleArchive(habit)}
                    />
                  }
                />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
