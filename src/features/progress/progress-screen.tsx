import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  computeBmi,
  dailyWeightSeries,
  filterSeriesByPeriod,
  formatMinutesAsHours,
  rollingAverage,
  summarizeSleepDay,
  weightChangeFromReference,
  type ChartPeriod,
} from '../../domain/evolution/evolution';
import {
  Button,
  Card,
  Header,
  NavRow,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import { DateSelector, LoadState, numberText } from '../diary/components';
import { TrendChart } from './trend-chart';
import { useEvolution } from './use-evolution';

const periodItems: { value: ChartPeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'total', label: 'Total' },
];

export function ProgressHubScreen() {
  const { snapshot, data, selectedDate, error, retry } = useEvolution();
  const router = useRouter();
  const [period, setPeriod] = useState<ChartPeriod>('30d');

  if (!snapshot) return null;
  const visible = snapshot.preferences.visibility;
  const dailyWeights = data ? dailyWeightSeries(data.weights) : [];
  const latestWeight = dailyWeights[dailyWeights.length - 1] ?? null;
  const rolling7 = rollingAverage(dailyWeights, selectedDate, 7);
  const change = weightChangeFromReference(
    latestWeight?.value ?? null,
    snapshot.profile.referenceWeightKg,
  );
  const bmi = computeBmi(latestWeight?.value ?? null, snapshot.profile.heightCm);
  const filteredSeries = filterSeriesByPeriod(dailyWeights, period, selectedDate);
  const sleepSummary = data ? summarizeSleepDay(data.daySleep) : null;
  const activeHabits = data ? data.habits.filter((h) => !h.archivedAt) : [];
  const habitsDoneCount = data ? data.dayHabitLogs.filter((l) => l.status === 'done').length : 0;

  return (
    <Screen>
      <Header
        eyebrow="Evolução / Tendências"
        title="Seus dados reais."
        description="Acompanhe tendências, sono, hábitos e revisão sem julgamento."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          {visible.weight ? (
            <Card>
              <Txt kind="eyebrow">Peso</Txt>
              <Txt kind="heading">
                {latestWeight ? `${numberText(latestWeight.value)} kg` : 'Não registrado'}
              </Txt>
              {latestWeight ? (
                <Txt kind="muted">Última pesagem considerada em {latestWeight.localDate}.</Txt>
              ) : null}
              {rolling7.average !== null ? (
                <Txt kind="muted">
                  Média móvel 7 dias: {numberText(rolling7.average)} kg ({rolling7.count}/
                  {rolling7.totalDays} dia(s) com registro)
                </Txt>
              ) : (
                <Txt kind="muted">Média móvel 7 dias: sem registros no período.</Txt>
              )}
              {change ? (
                <Txt kind="muted">
                  Variação desde referência ({numberText(snapshot.profile.referenceWeightKg ?? 0)}{' '}
                  kg):{' '}
                  {change.deltaKg > 0
                    ? `+${numberText(change.deltaKg)}`
                    : numberText(change.deltaKg)}{' '}
                  kg (
                  {change.reductionPct >= 0
                    ? `−${numberText(change.reductionPct)}%`
                    : `+${numberText(Math.abs(change.reductionPct))}%`}
                  )
                </Txt>
              ) : null}
              {bmi !== null ? (
                <Txt kind="muted">IMC (triagem, não composição corporal): {numberText(bmi)}</Txt>
              ) : null}
              <SegmentedControl
                options={periodItems}
                value={period}
                onChange={(v) => setPeriod(v as ChartPeriod)}
              />
              <TrendChart
                points={filteredSeries}
                unit="kg"
                referenceLines={data.milestones.map((m) => ({
                  label: m.title,
                  value: m.targetWeightKg,
                }))}
              />
              <Button
                title="Registrar ou editar peso"
                icon="scale-outline"
                onPress={() => router.push('/progress/weight')}
              />
            </Card>
          ) : (
            <Notice>
              Acompanhamento de peso está oculto nas preferências. Seus registros existentes
              permanecem preservados.
            </Notice>
          )}

          {visible.measurements ? (
            <Card>
              <Txt kind="eyebrow">Medidas corporais</Txt>
              <Txt kind="heading">
                {data.measurements.length
                  ? `${data.measurements.length} registro(s) salvo(s)`
                  : 'Não registrado'}
              </Txt>
              <Button
                secondary
                title="Abrir medidas corporais"
                icon="resize-outline"
                onPress={() => router.push('/progress/measurements')}
              />
            </Card>
          ) : null}

          {visible.sleep ? (
            <Card>
              <Txt kind="eyebrow">Sono em {selectedDate}</Txt>
              <Txt kind="heading">
                {sleepSummary && sleepSummary.totalMinutes > 0
                  ? formatMinutesAsHours(sleepSummary.totalMinutes)
                  : 'Não registrado'}
              </Txt>
              {sleepSummary && sleepSummary.napMinutes > 0 ? (
                <Txt kind="muted">
                  Principal: {formatMinutesAsHours(sleepSummary.mainMinutes)} · Cochilos:{' '}
                  {formatMinutesAsHours(sleepSummary.napMinutes)}
                </Txt>
              ) : null}
              <Button
                secondary
                title="Registrar ou revisar sono"
                icon="moon-outline"
                onPress={() => router.push('/progress/sleep')}
              />
            </Card>
          ) : null}

          <View style={{ gap: 10 }}>
            <NavRow
              title="Hábitos do dia"
              detail={`${habitsDoneCount}/${activeHabits.length} marcado(s) como feito em ${selectedDate}`}
              href="/progress/habits"
              icon="checkmark-circle-outline"
            />
            <NavRow
              title="Calendário mensal"
              detail="Indicadores de alimentação, água, treino, sono e peso"
              href="/progress/calendar"
              icon="calendar-outline"
            />
            <NavRow
              title="Revisão semanal e mensal"
              detail="Métricas com cobertura, notas e resumo copiável"
              href="/progress/review"
              icon="document-text-outline"
            />
            <NavRow
              title="Metas e vigências"
              detail="Alterar metas a partir de hoje ou data futura"
              href="/settings/goals"
              icon="flag-outline"
            />
          </View>
        </>
      )}
    </Screen>
  );
}
