import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  ActionSheetModal,
  Button,
  Card,
  Choice,
  ExpandableSection,
  Field,
  Header,
  IconButton,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import {
  adjustRestTimer,
  calculateExerciseVolume,
  calculateSessionVolume,
  computeRemainingRestSeconds,
  loadConventionLabels,
  startRestTimer,
  type Exercise,
  type SessionExercise,
  type WorkoutSet,
} from '../../domain/training/training';
import { parseOptionalNumber } from '../../domain/profile/profile';
import { LoadState, numberText } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function SetRowEditor({
  index,
  setItem,
  onSave,
  onSkip,
  onRemove,
}: {
  index: number;
  setItem: WorkoutSet;
  onSave: (next: WorkoutSet) => void;
  onSkip: () => void;
  onRemove: () => void;
}) {
  const [loadText, setLoadText] = useState(setItem.loadKg !== null ? String(setItem.loadKg) : '');
  const [repsText, setRepsText] = useState(setItem.reps !== null ? String(setItem.reps) : '');
  const [rirText, setRirText] = useState(setItem.rir !== null ? String(setItem.rir) : '');
  const [rpeText, setRpeText] = useState(setItem.rpe !== null ? String(setItem.rpe) : '');

  function buildSet(status: WorkoutSet['status']): WorkoutSet {
    const load = parseOptionalNumber(loadText);
    const repsParsed = repsText.trim() ? Number.parseInt(repsText.trim(), 10) : null;
    const rirParsed = rirText.trim() ? Number.parseInt(rirText.trim(), 10) : null;
    const rpeParsed = parseOptionalNumber(rpeText);
    return {
      ...setItem,
      loadKg: load !== null && Number.isFinite(load) ? load : null,
      reps: repsParsed !== null && Number.isFinite(repsParsed) ? repsParsed : null,
      rir: rirParsed !== null && Number.isFinite(rirParsed) ? rirParsed : null,
      rpe: rpeParsed !== null && Number.isFinite(rpeParsed) ? rpeParsed : null,
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
    };
  }

  const statusLabel =
    setItem.status === 'completed'
      ? 'Concluída'
      : setItem.status === 'skipped'
        ? 'Pulada'
        : 'Pendente';

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt kind="label">
          Série {index + 1} · {statusLabel}
        </Txt>
        <IconButton icon="trash-outline" label={`Remover série ${index + 1}`} onPress={onRemove} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Carga (kg)"
            value={loadText}
            onChangeText={setLoadText}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Reps"
            value={repsText}
            onChangeText={setRepsText}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
      </View>
      <ExpandableSection title="RIR, RPE e tipo da série">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="RIR (0–10)"
              value={rirText}
              onChangeText={setRirText}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="RPE (1–10)"
              value={rpeText}
              onChangeText={setRpeText}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['working', 'warmup', 'backoff'] as const).map((kind) => (
            <Choice
              key={kind}
              label={
                kind === 'working' ? 'Trabalho' : kind === 'warmup' ? 'Aquecimento' : 'Back-off'
              }
              selected={setItem.setType === kind}
              onPress={() => onSave({ ...buildSet(setItem.status), setType: kind })}
            />
          ))}
        </View>
      </ExpandableSection>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title={setItem.status === 'completed' ? 'Atualizar série' : 'Concluir série'}
          compact
          icon="checkmark-outline"
          onPress={() => onSave(buildSet('completed'))}
        />
        <Button title="Pular" secondary compact onPress={onSkip} />
      </View>
    </Card>
  );
}

export function SessionScreen() {
  const { data, snapshot, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const router = useRouter();
  const profileId = snapshot?.profile.id;
  const session = data?.activeSession ?? null;

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<SessionExercise | null>(null);
  const [exerciseMenu, setExerciseMenu] = useState<SessionExercise | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const remainingSeconds = session ? computeRemainingRestSeconds(session.restTimer, nowMs) : 0;

  useEffect(() => {
    if (!session?.restTimer.targetEndAt) return;
    const timer = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(timer);
  }, [session?.restTimer.targetEndAt]);

  const activeExercises = data?.library.exercises.filter((e) => !e.archived) ?? [];

  function buildSessionExerciseFromCatalog(ex: Exercise): SessionExercise {
    return {
      id: randomUUID(),
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      loadConvention: ex.loadConvention,
      restSeconds: ex.defaultRestSeconds,
      notes: ex.notes,
      sets: [
        {
          id: randomUUID(),
          setType: 'working',
          reps: null,
          loadKg: null,
          rir: null,
          rpe: null,
          status: 'pending',
          completedAt: null,
        },
      ],
    };
  }

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Sessão ativa"
        title={session?.title ?? 'Sessão de treino'}
        description={
          session
            ? `Data civil ${session.localDate} · Persistência série a série.`
            : 'Nenhuma sessão ativa no momento.'
        }
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : !session ? (
        <Card>
          <Txt kind="muted">Nenhuma sessão ativa encontrada neste dispositivo.</Txt>
          <Button title="Voltar para Treinos" onPress={() => router.replace('/(tabs)/training')} />
        </Card>
      ) : (
        <>
          <Card>
            <Txt kind="eyebrow">Timer de descanso (absoluto)</Txt>
            <Txt kind="title">{formatSeconds(remainingSeconds)}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                title="60s"
                secondary
                compact
                onPress={() => {
                  if (!training || !profileId) return;
                  void action.run(async () => {
                    await training.updateRestTimer(profileId, session.id, startRestTimer(60));
                    recordsChanged();
                  }, 'Timer ajustado para 60s.');
                }}
              />
              <Button
                title="90s"
                secondary
                compact
                onPress={() => {
                  if (!training || !profileId) return;
                  void action.run(async () => {
                    await training.updateRestTimer(profileId, session.id, startRestTimer(90));
                    recordsChanged();
                  }, 'Timer ajustado para 90s.');
                }}
              />
              <Button
                title="+15s"
                secondary
                compact
                onPress={() => {
                  if (!training || !profileId) return;
                  void action.run(async () => {
                    await training.updateRestTimer(
                      profileId,
                      session.id,
                      adjustRestTimer(session.restTimer, 15),
                    );
                    recordsChanged();
                  });
                }}
              />
              <Button
                title="Zerar"
                secondary
                compact
                onPress={() => {
                  if (!training || !profileId) return;
                  void action.run(async () => {
                    await training.updateRestTimer(profileId, session.id, startRestTimer(0));
                    recordsChanged();
                  });
                }}
              />
            </View>
          </Card>

          {(() => {
            const summary = calculateSessionVolume(session.exercises);
            return (
              <Card>
                <Txt kind="eyebrow">Resumo parcial</Txt>
                <Txt kind="heading">{numberText(summary.volumeKgReps)} kg·reps</Txt>
                <Txt kind="muted">
                  {summary.completedSets} concluída(s) · {summary.skippedSets} pulada(s) ·{' '}
                  {summary.pendingSets} pendente(s)
                </Txt>
              </Card>
            );
          })()}

          {session.exercises.map((ex, exIndex) => (
            <Card key={ex.id}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt kind="heading">
                    {exIndex + 1}. {ex.name}
                  </Txt>
                  <Txt kind="muted">
                    {loadConventionLabels[ex.loadConvention]} ·{' '}
                    {numberText(calculateExerciseVolume(ex.sets))} kg·reps
                  </Txt>
                </View>
                <IconButton
                  icon="ellipsis-horizontal"
                  label={`Opções de ${ex.name}`}
                  onPress={() => setExerciseMenu(ex)}
                />
              </View>

              {ex.sets.map((setItem, setIndex) => (
                <SetRowEditor
                  key={`${setItem.id}:${setItem.status}:${setItem.loadKg ?? ''}:${setItem.reps ?? ''}`}
                  index={setIndex}
                  setItem={setItem}
                  onSave={(next) => {
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.upsertSet(profileId, session.id, ex.id, next);
                      if (next.status === 'completed' && ex.restSeconds > 0) {
                        await training.updateRestTimer(
                          profileId,
                          session.id,
                          startRestTimer(ex.restSeconds),
                        );
                      }
                      recordsChanged();
                    }, 'Série salva.');
                  }}
                  onSkip={() => {
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.upsertSet(profileId, session.id, ex.id, {
                        ...setItem,
                        status: 'skipped',
                        completedAt: null,
                      });
                      recordsChanged();
                    }, 'Série marcada como pulada.');
                  }}
                  onRemove={() => {
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.removeSet(profileId, session.id, ex.id, setItem.id);
                      recordsChanged();
                    }, 'Série removida.');
                  }}
                />
              ))}

              <Button
                title="Adicionar série"
                secondary
                compact
                icon="add-outline"
                onPress={() => {
                  if (!training || !profileId) return;
                  const lastSet = ex.sets[ex.sets.length - 1];
                  void action.run(async () => {
                    await training.upsertSet(profileId, session.id, ex.id, {
                      id: randomUUID(),
                      setType: 'working',
                      reps: lastSet?.reps ?? null,
                      loadKg: lastSet?.loadKg ?? null,
                      rir: null,
                      rpe: null,
                      status: 'pending',
                      completedAt: null,
                    });
                    recordsChanged();
                  }, 'Série adicionada.');
                }}
              />
            </Card>
          ))}

          <Card>
            <Button
              title="Adicionar exercício"
              secondary
              icon="add-outline"
              onPress={() => setAddExerciseOpen(true)}
            />
            <Button
              title="Vincular cardio à sessão"
              secondary
              icon="walk-outline"
              onPress={() => router.push(`/training/cardio?sessionId=${session.id}`)}
            />
            <Button
              title="Concluir treino"
              icon="checkmark-circle-outline"
              busy={action.busy}
              onPress={() => {
                if (!training || !profileId) return;
                void action
                  .run(async () => {
                    await training.completeSession(profileId, session.id);
                    recordsChanged();
                  }, 'Treino concluído.')
                  .then((ok) => {
                    if (ok) router.replace('/(tabs)/training');
                  });
              }}
            />
            <Button
              title="Cancelar treino"
              secondary
              icon="close-circle-outline"
              onPress={() => setCancelConfirmOpen(true)}
            />
          </Card>
        </>
      )}

      <ActionSheetModal
        visible={addExerciseOpen}
        title="Adicionar exercício"
        onClose={() => setAddExerciseOpen(false)}
        actions={
          activeExercises.length
            ? activeExercises.map((ex) => ({
                label: ex.name,
                onPress: () => {
                  setAddExerciseOpen(false);
                  if (!training || !profileId || !session) return;
                  void action.run(async () => {
                    await training.addExerciseToSession(
                      profileId,
                      session.id,
                      buildSessionExerciseFromCatalog(ex),
                    );
                    recordsChanged();
                  }, 'Exercício adicionado à sessão.');
                },
              }))
            : [{ label: 'Fechar (biblioteca vazia)', onPress: () => setAddExerciseOpen(false) }]
        }
      />

      <ActionSheetModal
        visible={Boolean(swapTarget)}
        title="Trocar exercício"
        subtitle={swapTarget ? `Substituir ${swapTarget.name} mantendo o restante do treino.` : ''}
        onClose={() => setSwapTarget(null)}
        actions={activeExercises.map((ex) => ({
          label: ex.name,
          onPress: () => {
            const target = swapTarget;
            setSwapTarget(null);
            if (!training || !profileId || !session || !target) return;
            void action.run(async () => {
              await training.replaceSessionExercise(profileId, session.id, {
                ...target,
                exerciseId: ex.id,
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                equipment: ex.equipment,
                loadConvention: ex.loadConvention,
                restSeconds: ex.defaultRestSeconds,
              });
              recordsChanged();
            }, 'Exercício substituído.');
          },
        }))}
      />

      <ActionSheetModal
        visible={Boolean(exerciseMenu)}
        title={exerciseMenu?.name ?? ''}
        onClose={() => setExerciseMenu(null)}
        actions={
          exerciseMenu && session
            ? [
                ...(exerciseMenu.exerciseId
                  ? [
                      {
                        label: 'Copiar última sessão comparável',
                        onPress: () => {
                          const target = exerciseMenu;
                          setExerciseMenu(null);
                          if (!training || !profileId || !target.exerciseId) return;
                          void action.run(async () => {
                            const prev = await training.findLastComparableExercise(
                              profileId,
                              target.exerciseId!,
                              target.loadConvention,
                              session.id,
                            );
                            if (!prev) throw new Error('Sem histórico comparável.');
                            await training.replaceSessionExercise(profileId, session.id, {
                              ...target,
                              sets: prev.sets.map((s) => ({
                                ...s,
                                id: randomUUID(),
                                status: 'pending',
                                completedAt: null,
                              })),
                            });
                            recordsChanged();
                          }, 'Séries copiadas da última sessão comparável.');
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Trocar exercício',
                  onPress: () => {
                    const target = exerciseMenu;
                    setExerciseMenu(null);
                    setSwapTarget(target);
                  },
                },
                {
                  label: 'Remover exercício',
                  destructive: true,
                  onPress: () => {
                    const target = exerciseMenu;
                    setExerciseMenu(null);
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.removeSessionExercise(profileId, session.id, target.id);
                      recordsChanged();
                    }, 'Exercício removido.');
                  },
                },
              ]
            : []
        }
      />

      <ActionSheetModal
        visible={cancelConfirmOpen}
        title="Cancelar treino?"
        subtitle="A sessão será marcada como cancelada e não contará como treino concluído."
        onClose={() => setCancelConfirmOpen(false)}
        actions={[
          {
            label: 'Confirmar cancelamento',
            destructive: true,
            onPress: () => {
              setCancelConfirmOpen(false);
              if (!training || !profileId || !session) return;
              void action
                .run(async () => {
                  await training.cancelSession(profileId, session.id);
                  recordsChanged();
                }, 'Treino cancelado.')
                .then((ok) => {
                  if (ok) router.replace('/(tabs)/training');
                });
            },
          },
        ]}
      />
    </Screen>
  );
}
