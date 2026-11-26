import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActionSheetModal,
  Button,
  Card,
  CompactRow,
  Header,
  NavRow,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import {
  calculateSessionVolume,
  resolvePlannedDay,
  summarizeCardioDay,
  type WorkoutSession,
  type WorkoutTemplate,
} from '../../domain/training/training';
import { DateSelector, LoadState, numberText } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

function buildSessionFromTemplate(
  localDate: string,
  timezone: string,
  template: WorkoutTemplate | null,
): WorkoutSession {
  const nowIso = new Date().toISOString();
  return {
    id: randomUUID(),
    templateId: template?.id ?? null,
    localDate,
    startedAt: nowIso,
    completedAt: null,
    timezoneAtEntry: timezone,
    status: 'active',
    title: template ? template.name : 'Treino livre',
    sourceTemplateName: template?.name ?? null,
    notes: '',
    restTimer: { targetEndAt: null, durationSeconds: 0 },
    exercises: template
      ? template.exercises.map((item) => ({
          id: randomUUID(),
          exerciseId: item.exerciseId,
          name: item.nameSnapshot,
          muscleGroup: 'other',
          equipment: '',
          loadConvention: item.loadConvention,
          restSeconds: item.restSeconds,
          notes: item.notes,
          sets: Array.from({ length: item.targetSets }, () => ({
            id: randomUUID(),
            setType: 'working' as const,
            reps: null,
            loadKg: null,
            rir: null,
            rpe: null,
            status: 'pending' as const,
            completedAt: null,
          })),
        }))
      : [],
  };
}

export function TrainingHomeScreen() {
  const { data, snapshot, selectedDate, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);

  const profileId = snapshot?.profile.id;
  const timezone = snapshot?.profile.timezone ?? 'America/Sao_Paulo';
  const activeTemplates = data?.library.templates.filter((t) => !t.archived) ?? [];
  const planned = data
    ? resolvePlannedDay(
        selectedDate,
        data.library.planVersions,
        data.library.dayOverrides,
        activeTemplates,
      )
    : null;
  const cardioSummary = data ? summarizeCardioDay(data.dayCardio) : null;

  async function startWorkout(template: WorkoutTemplate | null) {
    if (!training || !profileId) return;
    const session = buildSessionFromTemplate(selectedDate, timezone, template);
    const ok = await action.run(async () => {
      await training.startSession(profileId, session);
      recordsChanged();
    }, 'Treino iniciado.');
    if (ok) router.push('/training/session');
  }

  return (
    <Screen>
      <Header
        eyebrow="Evolução / Treinos"
        title="Treinos"
        description="Fichas, agenda versionada, execução com timer e cardio."
      />
      <DateSelector key={selectedDate} />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          {data.activeSession ? (
            <Card>
              <Txt kind="eyebrow">Sessão em andamento</Txt>
              <Txt kind="heading">{data.activeSession.title}</Txt>
              <Txt kind="muted">
                Iniciada em {data.activeSession.localDate} · {data.activeSession.exercises.length}{' '}
                exercício(s)
              </Txt>
              <Button
                title="Retomar treino"
                icon="play-outline"
                onPress={() => router.push('/training/session')}
              />
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Planejado para o dia</Txt>
            {planned?.kind === 'template' && planned.template ? (
              <>
                <Txt kind="heading">{planned.template.name}</Txt>
                <Txt kind="muted">
                  {planned.template.exercises.length} exercício(s)
                  {planned.override ? ' · Troca pontual' : ''}
                </Txt>
                {!data.activeSession ? (
                  <Button
                    title="Iniciar pela ficha"
                    icon="barbell-outline"
                    busy={action.busy}
                    onPress={() => void startWorkout(planned.template)}
                  />
                ) : null}
              </>
            ) : planned?.kind === 'rest' ? (
              <>
                <Txt kind="heading">Descanso planejado</Txt>
                <Txt kind="muted">
                  {planned.override
                    ? 'Marcado como descanso para esta data.'
                    : 'Dia de descanso na agenda.'}
                </Txt>
              </>
            ) : (
              <>
                <Txt kind="heading">Sem ficha agendada</Txt>
                <Txt kind="muted">
                  Você pode iniciar um treino livre ou configurar sua agenda semanal.
                </Txt>
              </>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {!data.activeSession ? (
                <Button
                  title="Treino livre"
                  secondary
                  compact
                  icon="add-outline"
                  busy={action.busy}
                  onPress={() => void startWorkout(null)}
                />
              ) : null}
              <Button
                title="Trocar ficha do dia"
                secondary
                compact
                icon="swap-horizontal-outline"
                onPress={() => setSwapOpen(true)}
              />
              {planned?.kind !== 'rest' ? (
                <Button
                  title="Marcar descanso"
                  secondary
                  compact
                  icon="moon-outline"
                  busy={action.busy}
                  onPress={() => {
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.saveDayOverride(profileId, {
                        id: randomUUID(),
                        localDate: selectedDate,
                        kind: 'rest',
                        templateId: null,
                        notes: '',
                      });
                      recordsChanged();
                    }, 'Dia marcado como descanso.');
                  }}
                />
              ) : null}
              {planned?.override ? (
                <Button
                  title="Restaurar agenda"
                  secondary
                  compact
                  busy={action.busy}
                  onPress={() => {
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.deleteDayOverride(profileId, selectedDate);
                      recordsChanged();
                    }, 'Agenda padrão restaurada.');
                  }}
                />
              ) : null}
            </View>
          </Card>

          <Card>
            <Txt kind="eyebrow">Registros do dia</Txt>
            {data.daySessions.length ? (
              data.daySessions.map((session) => {
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
                    title={session.title}
                    subtitle={`${statusLabel} · ${summary.completedSets}/${summary.totalSets} séries · ${numberText(summary.volumeKgReps)} kg·reps`}
                    onPress={() =>
                      router.push(
                        session.status === 'active'
                          ? '/training/session'
                          : `/training/history?sessionId=${session.id}`,
                      )
                    }
                  />
                );
              })
            ) : (
              <Txt kind="muted">Nenhuma sessão registrada nesta data.</Txt>
            )}
            <Txt kind="muted">
              Cardio do dia:{' '}
              {cardioSummary && cardioSummary.count > 0
                ? `${cardioSummary.totalMinutes} min${cardioSummary.totalDistanceKm !== null ? ` · ${numberText(cardioSummary.totalDistanceKm)} km` : ''}`
                : 'Não registrado'}
            </Txt>
            <Button
              title="Registrar cardio"
              secondary
              icon="walk-outline"
              onPress={() => router.push('/training/cardio')}
            />
          </Card>
        </>
      )}

      <Card>
        <Txt kind="eyebrow">Organização e histórico</Txt>
        <NavRow
          title="Biblioteca de exercícios"
          detail="Criar, editar, arquivar ou importar base inicial"
          href="/training/library"
          icon="list-outline"
        />
        <NavRow
          title="Fichas de treino"
          detail="Readaptação, treino A/B e fichas personalizadas"
          href="/training/templates"
          icon="documents-outline"
        />
        <NavRow
          title="Agenda versionada"
          detail="Vigências por data e distribuição semanal"
          href="/training/plan"
          icon="calendar-outline"
        />
        <NavRow
          title="Histórico e recordes"
          detail="Sessões concluídas, volume e edição retroativa"
          href="/training/history"
          icon="trophy-outline"
        />
      </Card>

      <ActionSheetModal
        visible={swapOpen}
        title="Trocar ficha do dia"
        subtitle={`Escolha uma ficha para ${selectedDate}.`}
        onClose={() => setSwapOpen(false)}
        actions={
          activeTemplates.length
            ? activeTemplates.map((tpl) => ({
                label: tpl.name,
                onPress: () => {
                  setSwapOpen(false);
                  if (!training || !profileId) return;
                  void action.run(async () => {
                    await training.saveDayOverride(profileId, {
                      id: randomUUID(),
                      localDate: selectedDate,
                      kind: 'swap',
                      templateId: tpl.id,
                      notes: '',
                    });
                    recordsChanged();
                  }, 'Ficha do dia atualizada.');
                },
              }))
            : [
                {
                  label: 'Criar ou importar fichas',
                  onPress: () => {
                    setSwapOpen(false);
                    router.push('/training/templates');
                  },
                },
              ]
        }
      />
    </Screen>
  );
}
