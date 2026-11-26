import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { eventInstant, localTimeAt } from '../../core/date-time/event-time';
import { isLocalDate } from '../../core/date-time/local-date';
import {
  dailyWeightSeries,
  defaultMilestoneSuggestions,
  isUnusualWeight,
  weightChangeFromReference,
  type BodyMilestone,
  type WeightEntry,
} from '../../domain/evolution/evolution';
import { parseOptionalNumber, timeSchema } from '../../domain/profile/profile';
import {
  Button,
  Card,
  CompactRow,
  Field,
  Header,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import { DateSelector, LoadState, numberText } from '../diary/components';
import { useEvolution } from './use-evolution';

export function WeightScreen() {
  const { snapshot, evolution, data, selectedDate, recordsChanged, error, retry } = useEvolution();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneWeight, setMilestoneWeight] = useState('');

  if (!snapshot) return null;
  const tz = snapshot.profile.timezone;
  const currentWeights = data?.weights ?? [];
  const dailySeries = dailyWeightSeries(currentWeights);
  const latestDaily = dailySeries[dailySeries.length - 1] ?? null;

  const resetForm = () => {
    setEditingId(null);
    setDateInput('');
    setTimeInput('');
    setWeightInput('');
    setNotesInput('');
  };

  const commitWeight = async (parsedKg: number, localDate: string, time: string) => {
    if (!evolution) return;
    setBusy(true);
    setFeedback(null);
    try {
      const occurredAt = eventInstant(localDate, time, tz);
      const entry: WeightEntry = {
        id: editingId ?? randomUUID(),
        localDate,
        occurredAt,
        timezoneAtEntry: tz,
        weightKg: Number(parsedKg.toFixed(2)),
        notes: notesInput.trim(),
      };
      await evolution.saveWeight(snapshot.profile.id, entry);
      recordsChanged();
      resetForm();
      setFeedback('Pesagem salva.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Não foi possível salvar a pesagem.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (busy) return;
    const parsedKg = parseOptionalNumber(weightInput);
    if (parsedKg === null || Number.isNaN(parsedKg) || parsedKg <= 0 || parsedKg > 500) {
      setFeedback('Informe um peso válido em kg (ex.: 85,5).');
      return;
    }
    const localDate = dateInput.trim() || selectedDate;
    if (!isLocalDate(localDate)) {
      setFeedback('Informe uma data válida no formato AAAA-MM-DD.');
      return;
    }
    const time = timeInput.trim() || localTimeAt(new Date(), tz);
    if (!timeSchema.safeParse(time).success) {
      setFeedback('Informe um horário válido no formato HH:mm.');
      return;
    }
    if (isUnusualWeight(parsedKg, latestDaily?.value ?? snapshot.profile.referenceWeightKg)) {
      Alert.alert(
        'Confirmar valor atípico',
        `O valor ${numberText(parsedKg)} kg foge do padrão esperado. Deseja salvar mesmo assim?`,
        [
          { text: 'Revisar', style: 'cancel' },
          {
            text: 'Confirmar e salvar',
            onPress: () => void commitWeight(parsedKg, localDate, time),
          },
        ],
      );
      return;
    }
    void commitWeight(parsedKg, localDate, time);
  };

  const handleDelete = (entry: WeightEntry) => {
    Alert.alert('Excluir pesagem', `Remover registro de ${numberText(entry.weightKg)} kg?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (!evolution) return;
          setBusy(true);
          try {
            await evolution.deleteWeight(entry.id);
            recordsChanged();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleAddMilestone = async () => {
    if (!evolution || busy) return;
    const kg = parseOptionalNumber(milestoneWeight);
    if (!milestoneTitle.trim() || kg === null || Number.isNaN(kg) || kg <= 0) {
      setFeedback('Informe título e peso alvo válidos para o marco.');
      return;
    }
    setBusy(true);
    try {
      const m: BodyMilestone = {
        id: randomUUID(),
        title: milestoneTitle.trim(),
        targetWeightKg: Number(kg.toFixed(1)),
        achievedAt: null,
        notes: '',
      };
      await evolution.saveMilestone(snapshot.profile.id, m);
      setMilestoneTitle('');
      setMilestoneWeight('');
      recordsChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSuggestedMilestones = async () => {
    if (!evolution || busy) return;
    const suggestions = defaultMilestoneSuggestions(
      snapshot.profile.referenceWeightKg,
      snapshot.profile.targetWeightKg,
    );
    if (suggestions.length === 0) return;
    setBusy(true);
    try {
      await evolution.saveMilestonesBatch(
        snapshot.profile.id,
        suggestions.map((s) => ({
          id: randomUUID(),
          title: s.title,
          targetWeightKg: s.targetWeightKg,
          achievedAt: null,
          notes: s.notes,
        })),
      );
      recordsChanged();
    } finally {
      setBusy(false);
    }
  };

  const change = weightChangeFromReference(
    latestDaily?.value ?? null,
    snapshot.profile.referenceWeightKg,
  );

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Evolução / Peso"
        title="Pesagens reais."
        description="Múltiplas pesagens no mesmo dia são permitidas; as séries usam a última pesagem do dia."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="heading">{editingId ? 'Editar pesagem' : 'Nova pesagem'}</Txt>
            <Field
              label="Peso (kg)"
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="Ex.: 85,5"
            />
            <Field
              label="Data (AAAA-MM-DD)"
              value={dateInput}
              onChangeText={setDateInput}
              placeholder={selectedDate}
            />
            <Field
              label="Horário (HH:mm)"
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder={localTimeAt(new Date(), tz)}
            />
            <Field
              label="Observação (opcional)"
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="Ex.: Em jejum"
            />
            {feedback ? <Notice>{feedback}</Notice> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={editingId ? 'Atualizar pesagem' : 'Salvar pesagem'}
                  busy={busy}
                  onPress={handleSave}
                />
              </View>
              {editingId ? <Button secondary title="Cancelar" onPress={resetForm} /> : null}
            </View>
          </Card>

          {change ? (
            <Card>
              <Txt kind="eyebrow">Comparativo com referência inicial</Txt>
              <Txt>
                Referência: {numberText(snapshot.profile.referenceWeightKg ?? 0)} kg → Atual:{' '}
                {numberText(latestDaily?.value ?? 0)} kg
              </Txt>
              <Txt kind="muted">
                Diferença:{' '}
                {change.deltaKg > 0 ? `+${numberText(change.deltaKg)}` : numberText(change.deltaKg)}{' '}
                kg (
                {change.reductionPct >= 0
                  ? `redução de ${numberText(change.reductionPct)}%`
                  : `aumento de ${numberText(Math.abs(change.reductionPct))}%`}
                )
              </Txt>
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Histórico de pesagens</Txt>
            {data.weights.length === 0 ? (
              <Txt kind="muted">Nenhuma pesagem registrada.</Txt>
            ) : (
              data.weights.map((entry) => (
                <CompactRow
                  key={entry.id}
                  title={`${numberText(entry.weightKg)} kg`}
                  subtitle={`${entry.localDate} · ${localTimeAt(new Date(entry.occurredAt), entry.timezoneAtEntry)}${entry.notes ? ` · ${entry.notes}` : ''}`}
                  onPress={() => {
                    setEditingId(entry.id);
                    setWeightInput(String(entry.weightKg).replace('.', ','));
                    setDateInput(entry.localDate);
                    setTimeInput(localTimeAt(new Date(entry.occurredAt), entry.timezoneAtEntry));
                    setNotesInput(entry.notes);
                  }}
                  right={<Button secondary title="Excluir" onPress={() => handleDelete(entry)} />}
                />
              ))
            )}
          </Card>

          <Card>
            <Txt kind="eyebrow">Marcos pessoais opcionais</Txt>
            <Txt kind="muted">Sem prazos obrigatórios ou previsão linear garantida.</Txt>
            {data.milestones.length === 0 && snapshot.profile.referenceWeightKg ? (
              <Button
                secondary
                title="Carregar marcos sugeridos"
                busy={busy}
                onPress={() => void handleLoadSuggestedMilestones()}
              />
            ) : null}
            {data.milestones.map((m) => (
              <CompactRow
                key={m.id}
                title={`${m.title} · ${numberText(m.targetWeightKg)} kg`}
                subtitle={
                  latestDaily && latestDaily.value <= m.targetWeightKg
                    ? 'Alcançado nos registros atuais'
                    : m.notes || 'Em andamento'
                }
                right={
                  <Button
                    secondary
                    title="Remover"
                    onPress={async () => {
                      if (!evolution) return;
                      await evolution.deleteMilestone(m.id);
                      recordsChanged();
                    }}
                  />
                }
              />
            ))}
            <Field
              label="Novo marco"
              value={milestoneTitle}
              onChangeText={setMilestoneTitle}
              placeholder="Ex.: Meta intermediária"
            />
            <Field
              label="Peso do marco (kg)"
              value={milestoneWeight}
              onChangeText={setMilestoneWeight}
              keyboardType="decimal-pad"
              placeholder="Ex.: 80"
            />
            <Button
              secondary
              title="Adicionar marco"
              busy={busy}
              onPress={() => void handleAddMilestone()}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
