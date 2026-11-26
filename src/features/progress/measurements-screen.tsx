import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Alert } from 'react-native';

import { eventInstant, localTimeAt } from '../../core/date-time/event-time';
import {
  dailyMeasurementSeries,
  filterSeriesByPeriod,
  isUnusualMeasurement,
  measurementLabels,
  measurementMetrics,
  type ChartPeriod,
  type MeasurementEntry,
  type MeasurementMetric,
} from '../../domain/evolution/evolution';
import { parseOptionalNumber } from '../../domain/profile/profile';
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
import { DateSelector, LoadState, numberText } from '../diary/components';
import { TrendChart } from './trend-chart';
import { useEvolution } from './use-evolution';

const periodItems: { value: ChartPeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'total', label: 'Total' },
];

export function MeasurementsScreen() {
  const { snapshot, evolution, data, selectedDate, recordsChanged, error, retry } = useEvolution();
  const [values, setValues] = useState<Partial<Record<MeasurementMetric, string>>>({});
  const [notes, setNotes] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<MeasurementMetric>('waist');
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!snapshot) return null;
  const tz = snapshot.profile.timezone;

  const commitEntries = async (entries: MeasurementEntry[]) => {
    if (!evolution) return;
    setBusy(true);
    setFeedback(null);
    try {
      await evolution.saveMeasurements(snapshot.profile.id, entries);
      setValues({});
      setNotes('');
      recordsChanged();
      setFeedback(`${entries.length} medida(s) salva(s).`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Erro ao salvar medidas.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (busy) return;
    const time = localTimeAt(new Date(), tz);
    const occurredAt = eventInstant(selectedDate, time, tz);
    const entries: MeasurementEntry[] = [];
    let hasUnusual = false;

    for (const metric of measurementMetrics) {
      const raw = values[metric]?.trim() ?? '';
      if (!raw) continue;
      const parsed = parseOptionalNumber(raw);
      if (parsed === null || Number.isNaN(parsed) || parsed <= 0 || parsed > 400) {
        setFeedback(`Valor inválido em ${measurementLabels[metric]}.`);
        return;
      }
      if (isUnusualMeasurement(parsed)) hasUnusual = true;
      entries.push({
        id: randomUUID(),
        localDate: selectedDate,
        occurredAt,
        timezoneAtEntry: tz,
        metric,
        valueCm: Number(parsed.toFixed(1)),
        notes: notes.trim(),
      });
    }

    if (entries.length === 0) {
      setFeedback('Preencha ao menos uma medida em cm para salvar.');
      return;
    }

    if (hasUnusual) {
      Alert.alert('Confirmar medidas atípicas', 'Alguma medida está fora da faixa usual. Salvar?', [
        { text: 'Revisar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void commitEntries(entries) },
      ]);
      return;
    }

    void commitEntries(entries);
  };

  const series = data ? dailyMeasurementSeries(data.measurements, selectedMetric) : [];
  const filteredSeries = filterSeriesByPeriod(series, period, selectedDate);

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Medidas"
        title="Medidas corporais."
        description="Registre apenas as medidas que desejar acompanhar, em centímetros."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="heading">Registrar em {selectedDate}</Txt>
            {measurementMetrics.map((metric) => (
              <Field
                key={metric}
                label={`${measurementLabels[metric]} (cm)`}
                value={values[metric] ?? ''}
                onChangeText={(text) => setValues((prev) => ({ ...prev, [metric]: text }))}
                keyboardType="decimal-pad"
                placeholder="Opcional"
              />
            ))}
            <Field
              label="Observação (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex.: Medida em repouso"
            />
            {feedback ? <Notice>{feedback}</Notice> : null}
            <Button title="Salvar medidas preenchidas" busy={busy} onPress={handleSave} />
          </Card>

          <Card>
            <Txt kind="eyebrow">Tendência: {measurementLabels[selectedMetric]}</Txt>
            <SegmentedControl
              options={[
                { value: 'waist', label: 'Cintura' },
                { value: 'hip', label: 'Quadril' },
                { value: 'chest', label: 'Peito' },
                { value: 'neck', label: 'Pescoço' },
              ]}
              value={
                selectedMetric === 'waist' ||
                selectedMetric === 'hip' ||
                selectedMetric === 'chest' ||
                selectedMetric === 'neck'
                  ? selectedMetric
                  : 'waist'
              }
              onChange={(v) => setSelectedMetric(v as MeasurementMetric)}
            />
            <SegmentedControl
              options={periodItems}
              value={period}
              onChange={(v) => setPeriod(v as ChartPeriod)}
            />
            <TrendChart points={filteredSeries} unit="cm" />
          </Card>

          <Card>
            <Txt kind="eyebrow">Histórico recente</Txt>
            {data.measurements.length === 0 ? (
              <Txt kind="muted">Nenhuma medida registrada.</Txt>
            ) : (
              data.measurements.slice(0, 20).map((item) => (
                <CompactRow
                  key={item.id}
                  title={`${measurementLabels[item.metric]} · ${numberText(item.valueCm)} cm`}
                  subtitle={`${item.localDate}${item.notes ? ` · ${item.notes}` : ''}`}
                  right={
                    <Button
                      secondary
                      title="Excluir"
                      onPress={async () => {
                        if (!evolution) return;
                        await evolution.deleteMeasurement(item.id);
                        recordsChanged();
                      }}
                    />
                  }
                />
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
