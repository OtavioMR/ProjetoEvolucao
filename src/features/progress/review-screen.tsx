import * as Clipboard from 'expo-clipboard';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import {
  formatMinutesAsHours,
  formatReportMarkdown,
  monthRange,
  weekRangeForDate,
  type ReportExportFields,
  type WeeklyReview,
} from '../../domain/evolution/evolution';
import { useApp } from '../../shared/app-provider';
import {
  Button,
  Card,
  Field,
  Header,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import { DateSelector, LoadState, numberText } from '../diary/components';
import { usePeriodReview } from './use-evolution';

function ReviewNotesCard({
  weekStartDate,
  initialReview,
  busy,
  onSave,
}: {
  weekStartDate: string;
  initialReview: WeeklyReview | null;
  busy: boolean;
  onSave: (review: WeeklyReview) => Promise<void>;
}) {
  const [whatWorked, setWhatWorked] = useState(initialReview?.whatWorked ?? '');
  const [difficulties, setDifficulties] = useState(initialReview?.difficulties ?? '');
  const [energyNote, setEnergyNote] = useState(initialReview?.energyNote ?? '');
  const [hungerNote, setHungerNote] = useState(initialReview?.hungerNote ?? '');
  const [adjustments, setAdjustments] = useState(initialReview?.adjustments ?? '');

  return (
    <Card>
      <Txt kind="heading">Observações da semana ({weekStartDate})</Txt>
      <Field label="O que funcionou" value={whatWorked} onChangeText={setWhatWorked} multiline />
      <Field label="Dificuldades" value={difficulties} onChangeText={setDifficulties} multiline />
      <Field label="Disposição" value={energyNote} onChangeText={setEnergyNote} />
      <Field label="Fome e saciedade" value={hungerNote} onChangeText={setHungerNote} />
      <Field
        label="Ajustes desejados"
        value={adjustments}
        onChangeText={setAdjustments}
        multiline
      />
      <Button
        title="Salvar notas"
        busy={busy}
        onPress={() =>
          void onSave({
            id: initialReview?.id ?? randomUUID(),
            weekStartDate,
            whatWorked: whatWorked.trim(),
            difficulties: difficulties.trim(),
            energyNote: energyNote.trim(),
            hungerNote: hungerNote.trim(),
            preferences: '',
            adjustments: adjustments.trim(),
          })
        }
      />
    </Card>
  );
}

export function ReviewScreen() {
  const { snapshot, evolution, selectedDate, recordsChanged } = useApp();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const weekStart = snapshot?.preferences.weekStart ?? 1;
  const week = weekRangeForDate(selectedDate, weekStart);
  const month = monthRange(selectedDate.slice(0, 7));
  const startDate = mode === 'week' ? week.weekStartDate : month.startDate;
  const endDate = mode === 'week' ? week.weekEndDate : month.endDate;

  const { data, error, retry } = usePeriodReview(startDate, endDate, week.weekStartDate);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [fields, setFields] = useState<ReportExportFields>({
    weight: snapshot?.preferences.visibility.weight ?? true,
    measurements: snapshot?.preferences.visibility.measurements ?? true,
    nutrition: true,
    hydration: true,
    training: true,
    sleep: snapshot?.preferences.visibility.sleep ?? true,
    notes: true,
  });

  if (!snapshot) return null;
  const visible = snapshot.preferences.visibility;

  const handleSaveNotes = async (review: WeeklyReview) => {
    if (!evolution || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await evolution.saveWeeklyReview(snapshot.profile.id, review);
      recordsChanged();
      setFeedback('Notas da revisão salvas.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!data) return;
    const text = formatReportMarkdown(data.report, data.review, fields);
    await Clipboard.setStringAsync(text);
    setFeedback('Resumo copiado para a área de transferência.');
  };

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Revisão"
        title="Revisão descritiva."
        description="Observações baseadas apenas em registros reais e com indicação de cobertura."
      />
      <DateSelector key={selectedDate} />
      <SegmentedControl
        options={[
          { value: 'week', label: 'Semanal' },
          { value: 'month', label: 'Mensal' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'week' | 'month')}
      />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="eyebrow">
              Período: {data.report.startDate} a {data.report.endDate}
            </Txt>
            <Txt>
              Dias com algum dado: {data.report.daysWithAnyData}/{data.report.totalDays}
            </Txt>
            <Txt>
              Treinos concluídos: {data.report.completedWorkouts} (planejados:{' '}
              {data.report.plannedWorkouts}) · Cardio: {data.report.cardioMinutes} min
            </Txt>
            <Txt>
              Água média (nos dias registrados):{' '}
              {data.report.waterAvgMl !== null
                ? `${numberText(data.report.waterAvgMl)} mL (${data.report.waterDays} dia(s))`
                : 'Não registrado'}
            </Txt>
            <Txt>
              Alimentação: {data.report.mealDays}/{data.report.totalDays} dia(s) com refeições
            </Txt>
            {visible.calories && data.report.energyAvgKcal !== null ? (
              <Txt kind="muted">
                Energia média (dias completos): {numberText(data.report.energyAvgKcal)} kcal (
                {data.report.energyCompleteDays} dia(s))
              </Txt>
            ) : null}
            {visible.macros && data.report.proteinAvgG !== null ? (
              <Txt kind="muted">
                Proteína média (dias completos): {numberText(data.report.proteinAvgG)} g (
                {data.report.proteinCompleteDays} dia(s))
              </Txt>
            ) : null}
            {data.report.topMealContexts.length > 0 ? (
              <Txt kind="muted">
                Contextos mais relatados:{' '}
                {data.report.topMealContexts.map((c) => `${c.context} (${c.count})`).join(', ')}
              </Txt>
            ) : null}
            {visible.weight ? (
              <Txt>
                Peso médio:{' '}
                {data.report.weightAvgKg !== null
                  ? `${numberText(data.report.weightAvgKg)} kg (${data.report.weightDays} dia(s))`
                  : 'Não registrado'}
              </Txt>
            ) : null}
            {visible.measurements ? (
              <Txt>
                Cintura média:{' '}
                {data.report.waistAvgCm !== null
                  ? `${numberText(data.report.waistAvgCm)} cm (${data.report.waistDays} dia(s))`
                  : 'Não registrado'}
              </Txt>
            ) : null}
            {visible.sleep ? (
              <Txt>
                Sono médio:{' '}
                {data.report.sleepAvgMinutes !== null
                  ? `${formatMinutesAsHours(data.report.sleepAvgMinutes)} (${data.report.sleepDays} dia(s))`
                  : 'Não registrado'}
              </Txt>
            ) : null}
          </Card>

          <ReviewNotesCard
            key={`${week.weekStartDate}:${data.review?.id ?? 'new'}`}
            weekStartDate={week.weekStartDate}
            initialReview={data.review}
            busy={busy}
            onSave={handleSaveNotes}
          />

          <Card>
            <Txt kind="heading">Copiar resumo em texto/Markdown</Txt>
            <Txt kind="muted">Escolha quais campos incluir antes de copiar:</Txt>
            {(
              [
                ['weight', 'Peso'],
                ['measurements', 'Cintura'],
                ['nutrition', 'Alimentação'],
                ['hydration', 'Água'],
                ['training', 'Treinos e cardio'],
                ['sleep', 'Sono'],
                ['notes', 'Notas da semana'],
              ] as [keyof ReportExportFields, string][]
            ).map(([key, label]) => (
              <View
                key={key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Txt>{label}</Txt>
                <Switch
                  accessibilityLabel={`Incluir ${label}`}
                  value={fields[key]}
                  onValueChange={(val) => setFields((prev) => ({ ...prev, [key]: val }))}
                />
              </View>
            ))}
            {feedback ? <Notice>{feedback}</Notice> : null}
            <Button
              secondary
              title="Copiar resumo selecionado"
              icon="copy-outline"
              onPress={() => void handleCopyMarkdown()}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
