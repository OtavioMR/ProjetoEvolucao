import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Choice,
  CompactRow,
  Field,
  Header,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import {
  calculateSessionVolume,
  computeComparableRecords,
  loadConventionLabels,
  type SessionStatus,
  type WorkoutSession,
} from '../../domain/training/training';
import { parseOptionalNumber } from '../../domain/profile/profile';
import { LoadState, numberText } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTrainingHistory } from './use-training';

export function HistoryScreen() {
  const [statusFilter, setStatusFilter] = useState<'completed' | 'cancelled' | 'all'>('completed');
  const filterStatus: SessionStatus | undefined = statusFilter === 'all' ? undefined : statusFilter;
  const { data, snapshot, selectedDate, training, recordsChanged, error, retry } =
    useTrainingHistory({ status: filterStatus });
  const action = useAction();
  const profileId = snapshot?.profile.id;
  const timezone = snapshot?.profile.timezone ?? 'America/Sao_Paulo';

  const [manualOpen, setManualOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualTitle, setManualTitle] = useState('Treino registrado manualmente');
  const [manualExId, setManualExId] = useState<string | null>(null);
  const [manualLoad, setManualLoad] = useState('');
  const [manualReps, setManualReps] = useState('');
  const [manualSetsCount, setManualSetsCount] = useState('3');
  const [selectedRecordExId, setSelectedRecordExId] = useState<string | null>(null);

  const exercises = data?.library.exercises.filter((e) => !e.archived) ?? [];
  const chosenEx = exercises.find((e) => e.id === (manualExId ?? exercises[0]?.id)) ?? null;
  const recordEx = exercises.find((e) => e.id === (selectedRecordExId ?? exercises[0]?.id)) ?? null;
  const records =
    data && recordEx
      ? computeComparableRecords(data.sessions, recordEx.id, recordEx.loadConvention)
      : null;

  function openEdit(session: WorkoutSession) {
    setEditingSession(session);
    setManualDate(session.localDate);
    setManualTitle(session.title);
    const firstEx = session.exercises[0];
    setManualExId(firstEx?.exerciseId ?? exercises[0]?.id ?? null);
    const firstSet = firstEx?.sets[0];
    setManualLoad(
      firstSet?.loadKg !== null && firstSet?.loadKg !== undefined ? String(firstSet.loadKg) : '',
    );
    setManualReps(
      firstSet?.reps !== null && firstSet?.reps !== undefined ? String(firstSet.reps) : '',
    );
    setManualSetsCount(String(firstEx?.sets.length || 1));
    setManualOpen(true);
  }

  async function saveRetroactive() {
    if (!training || !profileId || !chosenEx) return;
    const loadVal = parseOptionalNumber(manualLoad);
    const repsVal = manualReps.trim() ? Number.parseInt(manualReps.trim(), 10) : null;
    const setsCount = Math.max(
      1,
      Math.min(20, Number.parseInt(manualSetsCount.trim() || '1', 10) || 1),
    );
    const nowIso = new Date().toISOString();

    const ok = await action.run(
      async () => {
        await training.saveRetroactiveSession(profileId, {
          id: editingSession?.id ?? randomUUID(),
          templateId: editingSession?.templateId ?? null,
          localDate: manualDate.trim(),
          startedAt: editingSession?.startedAt ?? nowIso,
          completedAt: editingSession?.completedAt ?? nowIso,
          timezoneAtEntry: editingSession?.timezoneAtEntry ?? timezone,
          status: 'completed',
          title: manualTitle,
          sourceTemplateName: editingSession?.sourceTemplateName ?? null,
          notes: editingSession?.notes ?? '',
          restTimer: { targetEndAt: null, durationSeconds: 0 },
          exercises: [
            {
              id: editingSession?.exercises[0]?.id ?? randomUUID(),
              exerciseId: chosenEx.id,
              name: chosenEx.name,
              muscleGroup: chosenEx.muscleGroup,
              equipment: chosenEx.equipment,
              loadConvention: chosenEx.loadConvention,
              restSeconds: chosenEx.defaultRestSeconds,
              notes: '',
              sets: Array.from({ length: setsCount }, () => ({
                id: randomUUID(),
                setType: 'working',
                reps: repsVal !== null && Number.isFinite(repsVal) ? repsVal : null,
                loadKg: loadVal !== null && Number.isFinite(loadVal) ? loadVal : null,
                rir: null,
                rpe: null,
                status: 'completed',
                completedAt: nowIso,
              })),
            },
          ],
        });
        recordsChanged();
      },
      editingSession ? 'Sessão retroativa atualizada.' : 'Treino anterior registrado.',
    );
    if (ok) {
      setManualOpen(false);
      setEditingSession(null);
    }
  }

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Histórico"
        title="Histórico e recordes"
        description="Consulte sessões, volume por critério e recordes comparáveis."
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <SegmentedControl
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'completed', label: 'Concluídos' },
                { value: 'cancelled', label: 'Cancelados' },
                { value: 'all', label: 'Todos' },
              ]}
            />
            <Button
              title="Registrar treino anterior"
              secondary
              icon="add-outline"
              onPress={() => {
                setEditingSession(null);
                setManualDate(selectedDate);
                setManualTitle('Treino anterior');
                setManualOpen(true);
              }}
            />
          </Card>

          {manualOpen ? (
            <Card>
              <Txt kind="heading">
                {editingSession ? 'Editar treino retroativo' : 'Registrar treino anterior'}
              </Txt>
              <Field
                label="Data civil (AAAA-MM-DD)"
                value={manualDate}
                onChangeText={setManualDate}
              />
              <Field label="Título" value={manualTitle} onChangeText={setManualTitle} />
              <Txt kind="label">Exercício principal</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {exercises.map((ex) => (
                  <Choice
                    key={ex.id}
                    label={ex.name}
                    selected={chosenEx?.id === ex.id}
                    onPress={() => setManualExId(ex.id)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Séries"
                    value={manualSetsCount}
                    onChangeText={setManualSetsCount}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Carga (kg)"
                    value={manualLoad}
                    onChangeText={setManualLoad}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Reps"
                    value={manualReps}
                    onChangeText={setManualReps}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Salvar" busy={action.busy} onPress={() => void saveRetroactive()} />
                <Button
                  title="Cancelar"
                  secondary
                  onPress={() => {
                    setManualOpen(false);
                    setEditingSession(null);
                  }}
                />
              </View>
            </Card>
          ) : null}

          {exercises.length ? (
            <Card>
              <Txt kind="eyebrow">Recordes comparáveis</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {exercises.slice(0, 6).map((ex) => (
                  <Choice
                    key={ex.id}
                    label={ex.name}
                    selected={recordEx?.id === ex.id}
                    onPress={() => setSelectedRecordExId(ex.id)}
                  />
                ))}
              </View>
              {recordEx && records ? (
                <>
                  <Txt kind="muted">{loadConventionLabels[recordEx.loadConvention]}</Txt>
                  <Txt kind="body">
                    Maior carga:{' '}
                    {records.maxLoadKg !== null ? `${numberText(records.maxLoadKg)} kg` : '—'} ·
                    Melhor série:{' '}
                    {records.maxSetVolume !== null
                      ? `${numberText(records.maxSetVolume)} kg·reps`
                      : '—'}
                  </Txt>
                  <Txt kind="muted">
                    Sessões comparáveis: {records.comparableSessionsCount}
                    {records.bestSessionDate
                      ? ` · Melhor sessão em ${records.bestSessionDate}`
                      : ''}
                  </Txt>
                </>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Sessões ({data.sessions.length})</Txt>
            {data.sessions.length ? (
              data.sessions.map((session) => {
                const summary = calculateSessionVolume(session.exercises);
                const statusLabel =
                  session.status === 'completed'
                    ? 'Concluído'
                    : session.status === 'active'
                      ? 'Em andamento'
                      : 'Cancelado';
                return (
                  <CompactRow
                    key={session.id}
                    title={`${session.localDate} · ${session.title}`}
                    subtitle={`${statusLabel} · ${summary.completedSets} série(s) · ${numberText(summary.volumeKgReps)} kg·reps`}
                    onPress={session.status === 'completed' ? () => openEdit(session) : undefined}
                  />
                );
              })
            ) : (
              <Txt kind="muted">Nenhuma sessão encontrada para este filtro.</Txt>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
