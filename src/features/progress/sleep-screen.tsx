import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { localTimeAt } from '../../core/date-time/event-time';
import {
  computeSleepInstants,
  formatMinutesAsHours,
  summarizeSleepDay,
  type SleepEntry,
} from '../../domain/evolution/evolution';
import { timeSchema } from '../../domain/profile/profile';
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

export function SleepScreen() {
  const { snapshot, evolution, data, selectedDate, recordsChanged, error, retry } = useEvolution();
  const [startTime, setStartTime] = useState(snapshot?.preferences.sleepStart ?? '23:30');
  const [endTime, setEndTime] = useState(snapshot?.preferences.sleepEnd ?? '07:30');
  const [isNap, setIsNap] = useState(false);
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!snapshot) return null;
  const tz = snapshot.profile.timezone;
  const daySummary = data ? summarizeSleepDay(data.daySleep) : null;

  const handleSave = async () => {
    if (!evolution || busy) return;
    if (
      !timeSchema.safeParse(startTime.trim()).success ||
      !timeSchema.safeParse(endTime.trim()).success
    ) {
      setFeedback('Use horários válidos no formato HH:mm.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const { startAt, endAt } = computeSleepInstants(
        selectedDate,
        startTime.trim(),
        endTime.trim(),
        tz,
      );
      const entry: SleepEntry = {
        id: randomUUID(),
        startAt,
        endAt,
        wakeLocalDate: selectedDate,
        timezoneAtEntry: tz,
        isNap,
        quality,
        notes: notes.trim(),
      };
      await evolution.saveSleep(snapshot.profile.id, entry);
      setNotes('');
      setQuality(null);
      recordsChanged();
      setFeedback('Registro de sono salvo.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Erro ao salvar sono.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (entry: SleepEntry) => {
    Alert.alert('Excluir registro de sono', 'Deseja remover este intervalo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (!evolution) return;
          setBusy(true);
          try {
            await evolution.deleteSleep(entry.id);
            recordsChanged();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Sono"
        title="Sono e descanso."
        description="Associado ao dia do despertar. Intervalos sobrepostos não são contados em dobro."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="eyebrow">Resumo em {selectedDate}</Txt>
            <Txt kind="heading">
              {daySummary && daySummary.totalMinutes > 0
                ? formatMinutesAsHours(daySummary.totalMinutes)
                : 'Não registrado'}
            </Txt>
            {daySummary && daySummary.totalMinutes > 0 ? (
              <Txt kind="muted">
                Sono principal: {formatMinutesAsHours(daySummary.mainMinutes)} · Cochilos:{' '}
                {formatMinutesAsHours(daySummary.napMinutes)}
                {daySummary.averageQuality !== null
                  ? ` · Qualidade média: ${daySummary.averageQuality.toLocaleString('pt-BR')}/5`
                  : ''}
              </Txt>
            ) : null}
          </Card>

          <Card>
            <Txt kind="heading">Registrar período (despertar em {selectedDate})</Txt>
            <Field
              label="Início (HH:mm)"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="23:30"
            />
            <Field
              label="Fim / despertar (HH:mm)"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="07:30"
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Txt>Cochilo separado</Txt>
              <Switch
                accessibilityLabel="Cochilo separado"
                value={isNap}
                onValueChange={setIsNap}
              />
            </View>
            <Txt kind="label">Qualidade subjetiva (opcional)</Txt>
            <SegmentedControl
              options={[
                { value: 'none', label: 'Sem nota' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
              ]}
              value={quality === null ? 'none' : String(quality)}
              onChange={(v) => setQuality(v === 'none' ? null : Number(v))}
            />
            <Field
              label="Observação (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex.: Acordei uma vez"
            />
            {feedback ? <Notice>{feedback}</Notice> : null}
            <Button title="Salvar sono" busy={busy} onPress={() => void handleSave()} />
          </Card>

          <Card>
            <Txt kind="eyebrow">Intervalos registrados</Txt>
            {data.daySleep.length === 0 ? (
              <Txt kind="muted">Nenhum registro para esta data.</Txt>
            ) : (
              data.daySleep.map((item) => (
                <CompactRow
                  key={item.id}
                  title={`${localTimeAt(new Date(item.startAt), item.timezoneAtEntry)} → ${localTimeAt(new Date(item.endAt), item.timezoneAtEntry)}`}
                  subtitle={`${item.isNap ? 'Cochilo' : 'Sono principal'}${item.quality ? ` · Qualidade ${item.quality}/5` : ''}${item.notes ? ` · ${item.notes}` : ''}`}
                  right={<Button secondary title="Excluir" onPress={() => handleDelete(item)} />}
                />
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
