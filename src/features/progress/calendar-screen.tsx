import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { monthGridDates } from '../../domain/evolution/evolution';
import { useApp } from '../../shared/app-provider';
import {
  Button,
  Card,
  Header,
  NavRow,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import { useTheme } from '../../shared/theme/theme';
import { LoadState, numberText } from '../diary/components';
import { useCalendarMonth } from './use-evolution';

type CalendarFilter = 'all' | 'training' | 'nutrition' | 'sleep' | 'weight';

const weekHeadersSun = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const weekHeadersMon = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function shiftYearMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CalendarScreen() {
  const { snapshot, selectedDate, selectDate } = useApp();
  const { colors } = useTheme();
  const router = useRouter();
  const [yearMonth, setYearMonth] = useState(selectedDate.slice(0, 7));
  const [filter, setFilter] = useState<CalendarFilter>('all');

  const { map, error, retry } = useCalendarMonth(yearMonth);
  const activeMap = map;

  if (!snapshot) return null;
  const weekStart = snapshot.preferences.weekStart;
  const visible = snapshot.preferences.visibility;
  const headers = weekStart === 1 ? weekHeadersMon : weekHeadersSun;
  const cells = monthGridDates(yearMonth, weekStart);
  const selectedDayActivity = activeMap?.[selectedDate];

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Calendário"
        title="Visão mensal."
        description="Toque em um dia para ver o resumo real e abrir os registros da data."
      />
      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Button
            secondary
            title="Anterior"
            onPress={() => setYearMonth((ym) => shiftYearMonth(ym, -1))}
          />
          <Txt kind="heading">{yearMonth}</Txt>
          <Button
            secondary
            title="Próximo"
            onPress={() => setYearMonth((ym) => shiftYearMonth(ym, 1))}
          />
        </View>
        <SegmentedControl
          options={[
            { value: 'all', label: 'Tudo' },
            { value: 'training', label: 'Treino' },
            { value: 'nutrition', label: 'Diário' },
            { value: 'sleep', label: 'Sono' },
            { value: 'weight', label: 'Peso' },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as CalendarFilter)}
        />
        {!activeMap ? (
          <LoadState error={error} retry={retry} />
        ) : (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row' }}>
              {headers.map((h, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Txt kind="muted">{h}</Txt>
                </View>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, rowIdx) => (
              <View key={rowIdx} style={{ flexDirection: 'row', gap: 4 }}>
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((date, colIdx) => {
                  if (!date) return <View key={colIdx} style={{ flex: 1, minHeight: 48 }} />;
                  const act = activeMap[date];
                  const isSelected = date === selectedDate;
                  const markers: string[] = [];
                  if (act) {
                    if (
                      (filter === 'all' || filter === 'nutrition') &&
                      (act.meals > 0 || act.waterMl > 0)
                    ) {
                      markers.push('A');
                    }
                    if (
                      (filter === 'all' || filter === 'training') &&
                      (act.workouts > 0 || act.cardioMinutes > 0)
                    ) {
                      markers.push('T');
                    }
                    if (
                      visible.sleep &&
                      (filter === 'all' || filter === 'sleep') &&
                      act.sleepMinutes > 0
                    ) {
                      markers.push('S');
                    }
                    if (
                      visible.weight &&
                      (filter === 'all' || filter === 'weight') &&
                      act.weightKg !== null
                    ) {
                      markers.push('P');
                    }
                  }
                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={`Dia ${date}, ${markers.length ? `registros ${markers.join(' ')}` : 'sem registros'}`}
                      onPress={() => selectDate(date)}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected ? colors.input : colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 4,
                      }}
                    >
                      <Txt kind="label">{Number(date.slice(8, 10))}</Txt>
                      <Txt kind="muted" style={{ fontSize: 10 }}>
                        {markers.join('·') || '—'}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Txt kind="muted">
              Legenda: A = Alimentação/Água · T = Treino/Cardio · S = Sono · P = Peso
            </Txt>
          </View>
        )}
      </Card>

      <Card>
        <Txt kind="eyebrow">Resumo de {selectedDate}</Txt>
        {!selectedDayActivity ? (
          <Txt kind="muted">Nenhum registro encontrado nesta data.</Txt>
        ) : (
          <View style={{ gap: 4 }}>
            <Txt>
              Refeições: {selectedDayActivity.meals} · Água:{' '}
              {numberText(selectedDayActivity.waterMl)} mL
            </Txt>
            <Txt>
              Treinos concluídos: {selectedDayActivity.workouts} · Cardio:{' '}
              {selectedDayActivity.cardioMinutes} min
            </Txt>
            {visible.sleep ? (
              <Txt>Sono: {Math.round((selectedDayActivity.sleepMinutes / 60) * 10) / 10} h</Txt>
            ) : null}
            {visible.weight ? (
              <Txt>
                Peso:{' '}
                {selectedDayActivity.weightKg !== null
                  ? `${numberText(selectedDayActivity.weightKg)} kg`
                  : 'Não registrado'}
              </Txt>
            ) : null}
          </View>
        )}
        <Button title="Abrir dia na aba Hoje" onPress={() => router.push('/(tabs)')} />
      </Card>

      <NavRow
        title="Diário alimentar da data"
        detail={selectedDate}
        href="/(tabs)/nutrition"
        icon="restaurant-outline"
      />
      <NavRow
        title="Treinos da data"
        detail={selectedDate}
        href="/(tabs)/training"
        icon="barbell-outline"
      />
    </Screen>
  );
}
