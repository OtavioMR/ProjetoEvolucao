import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActionSheetModal,
  Button,
  Card,
  Choice,
  CompactRow,
  Field,
  Header,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import {
  cardioIntensityLabels,
  cardioModalityLabels,
  summarizeCardioDay,
  type CardioEntry,
  type CardioIntensity,
  type CardioModality,
} from '../../domain/training/training';
import { parseOptionalNumber } from '../../domain/profile/profile';
import { DateSelector, LoadState, numberText } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

const modalities = Object.keys(cardioModalityLabels) as CardioModality[];
const intensities = Object.keys(cardioIntensityLabels) as CardioIntensity[];

export function CardioScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { data, snapshot, selectedDate, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const profileId = snapshot?.profile.id;
  const timezone = snapshot?.profile.timezone ?? 'America/Sao_Paulo';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [modality, setModality] = useState<CardioModality>('walk');
  const [intensity, setIntensity] = useState<CardioIntensity>('moderate');
  const [duration, setDuration] = useState('30');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(params.sessionId ?? null);
  const [selectedEntry, setSelectedEntry] = useState<CardioEntry | null>(null);

  function startEdit(entry: CardioEntry) {
    setEditingId(entry.id);
    setModality(entry.modality);
    setIntensity(entry.intensity);
    setDuration(String(entry.durationMinutes));
    setDistance(entry.distanceKm !== null ? String(entry.distanceKm) : '');
    setNotes(entry.notes);
    setSessionId(entry.sessionId);
  }

  async function saveCardio() {
    if (!training || !profileId) return;
    const mins = Number.parseInt(duration.trim(), 10);
    const dist = parseOptionalNumber(distance);
    const ok = await action.run(
      async () => {
        await training.saveCardio(profileId, {
          id: editingId ?? randomUUID(),
          sessionId,
          localDate: selectedDate,
          occurredAt: new Date().toISOString(),
          timezoneAtEntry: timezone,
          durationMinutes: Number.isFinite(mins) ? mins : 0,
          distanceKm: dist !== null && Number.isFinite(dist) ? dist : null,
          modality,
          intensity,
          notes,
        });
        recordsChanged();
      },
      editingId ? 'Cardio atualizado.' : 'Cardio registrado.',
    );
    if (ok) {
      setEditingId(null);
      setDistance('');
      setNotes('');
    }
  }

  const summary = data ? summarizeCardioDay(data.dayCardio) : null;

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Cardio"
        title="Cardio"
        description="Registre cardio independente ou vinculado a um treino, sem contagem duplicada."
      />
      <DateSelector key={selectedDate} />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="eyebrow">Resumo do dia</Txt>
            <Txt kind="heading">
              {summary && summary.count > 0
                ? `${summary.totalMinutes} min${summary.totalDistanceKm !== null ? ` · ${numberText(summary.totalDistanceKm)} km` : ''}`
                : 'Não registrado'}
            </Txt>
          </Card>

          <Card>
            <Txt kind="heading">{editingId ? 'Editar cardio' : 'Novo registro de cardio'}</Txt>
            <Txt kind="label">Modalidade</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {modalities.map((m) => (
                <Choice
                  key={m}
                  label={cardioModalityLabels[m]}
                  selected={modality === m}
                  onPress={() => setModality(m)}
                />
              ))}
            </View>
            <Txt kind="label">Intensidade</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {intensities.map((i) => (
                <Choice
                  key={i}
                  label={cardioIntensityLabels[i]}
                  selected={intensity === i}
                  onPress={() => setIntensity(i)}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Duração (min)"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Distância opcional (km)"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            {sessionId ? <Txt kind="muted">Vinculado à sessão de treino atual.</Txt> : null}
            <Field label="Observações" value={notes} onChangeText={setNotes} multiline />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Salvar cardio" busy={action.busy} onPress={() => void saveCardio()} />
              {editingId ? (
                <Button title="Cancelar edição" secondary onPress={() => setEditingId(null)} />
              ) : null}
            </View>
          </Card>

          <Card>
            <Txt kind="eyebrow">Registros em {selectedDate}</Txt>
            {data.dayCardio.length ? (
              data.dayCardio.map((entry) => (
                <CompactRow
                  key={entry.id}
                  title={`${cardioModalityLabels[entry.modality]} · ${entry.durationMinutes} min`}
                  subtitle={`${cardioIntensityLabels[entry.intensity]}${entry.distanceKm !== null ? ` · ${numberText(entry.distanceKm)} km` : ''}${entry.sessionId ? ' · Vinculado ao treino' : ' · Independente'}`}
                  onPress={() => setSelectedEntry(entry)}
                />
              ))
            ) : (
              <Txt kind="muted">Nenhum cardio registrado nesta data.</Txt>
            )}
          </Card>
        </>
      )}

      <ActionSheetModal
        visible={Boolean(selectedEntry)}
        title={selectedEntry ? cardioModalityLabels[selectedEntry.modality] : ''}
        onClose={() => setSelectedEntry(null)}
        actions={
          selectedEntry
            ? [
                {
                  label: 'Editar cardio',
                  onPress: () => {
                    const entry = selectedEntry;
                    setSelectedEntry(null);
                    startEdit(entry);
                  },
                },
                ...(selectedEntry.sessionId
                  ? [
                      {
                        label: 'Desvincular do treino (manter cardio)',
                        onPress: () => {
                          const entry = selectedEntry;
                          setSelectedEntry(null);
                          if (!training || !profileId) return;
                          void action.run(async () => {
                            await training.unlinkCardio(profileId, entry.id);
                            recordsChanged();
                          }, 'Cardio desvinculado e preservado.');
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Excluir cardio',
                  destructive: true,
                  onPress: () => {
                    const entry = selectedEntry;
                    setSelectedEntry(null);
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.deleteCardio(profileId, entry.id);
                      recordsChanged();
                    }, 'Cardio excluído.');
                  },
                },
              ]
            : []
        }
      />
    </Screen>
  );
}
