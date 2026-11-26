import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActionSheetModal,
  Button,
  Card,
  Choice,
  CompactRow,
  ExpandableSection,
  Field,
  Header,
  Notice,
  Screen,
  Toggle,
  Txt,
} from '../../shared/components/ui';
import {
  buildTrainingSeedBundle,
  loadConventionLabels,
  muscleGroupLabels,
  type Exercise,
  type LoadConvention,
  type MuscleGroup,
} from '../../domain/training/training';
import { LoadState } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

const muscleGroups = Object.keys(muscleGroupLabels) as MuscleGroup[];
const loadConventions = Object.keys(loadConventionLabels) as LoadConvention[];

export function LibraryScreen() {
  const { data, snapshot, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const profileId = snapshot?.profile.id;

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState('');
  const [loadConvention, setLoadConvention] = useState<LoadConvention>('total');
  const [defaultRest, setDefaultRest] = useState('90');
  const [notes, setNotes] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  function startCreate() {
    setEditingId(null);
    setName('');
    setMuscleGroup('chest');
    setEquipment('');
    setLoadConvention('total');
    setDefaultRest('90');
    setNotes('');
    setFormOpen(true);
  }

  function startEdit(ex: Exercise) {
    setEditingId(ex.id);
    setName(ex.name);
    setMuscleGroup(ex.muscleGroup);
    setEquipment(ex.equipment);
    setLoadConvention(ex.loadConvention);
    setDefaultRest(String(ex.defaultRestSeconds));
    setNotes(ex.notes);
    setFormOpen(true);
  }

  async function saveExercise() {
    if (!training || !profileId) return;
    const restSec = Number.parseInt(defaultRest.trim() || '90', 10);
    const ok = await action.run(
      async () => {
        await training.saveExercise(profileId, {
          id: editingId ?? randomUUID(),
          name,
          muscleGroup,
          equipment,
          loadConvention,
          defaultRestSeconds: Number.isFinite(restSec) ? restSec : 90,
          notes,
          archived: false,
        });
        recordsChanged();
      },
      editingId ? 'Exercício atualizado.' : 'Exercício adicionado.',
    );
    if (ok) setFormOpen(false);
  }

  const filtered = (data?.library.exercises ?? []).filter((ex) => {
    if (!showArchived && ex.archived) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.equipment.toLowerCase().includes(q) ||
      muscleGroupLabels[ex.muscleGroup].toLowerCase().includes(q)
    );
  });

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Biblioteca"
        title="Exercícios"
        description="Catálogo offline editável. Arquivar preserva o histórico anterior."
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button title="Novo exercício" icon="add-outline" onPress={startCreate} />
              <Button
                title="Importar catálogo inicial"
                secondary
                icon="download-outline"
                onPress={() => setSeedConfirmOpen(true)}
              />
            </View>
            <Field
              label="Buscar exercício"
              value={search}
              onChangeText={setSearch}
              placeholder="Nome, grupo ou equipamento"
            />
            <Toggle title="Mostrar arquivados" value={showArchived} onChange={setShowArchived} />
          </Card>

          {formOpen ? (
            <Card>
              <Txt kind="heading">{editingId ? 'Editar exercício' : 'Novo exercício'}</Txt>
              <Field
                label="Nome"
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Supino reto"
              />
              <Txt kind="label">Grupo muscular</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {muscleGroups.map((mg) => (
                  <Choice
                    key={mg}
                    label={muscleGroupLabels[mg]}
                    selected={muscleGroup === mg}
                    onPress={() => setMuscleGroup(mg)}
                  />
                ))}
              </View>
              <Field
                label="Equipamento"
                value={equipment}
                onChangeText={setEquipment}
                placeholder="Ex.: Máquina, Halteres, Barra"
              />
              <Txt kind="label">Convenção de carga</Txt>
              <View style={{ gap: 8 }}>
                {loadConventions.map((lc) => (
                  <Choice
                    key={lc}
                    label={loadConventionLabels[lc]}
                    selected={loadConvention === lc}
                    onPress={() => setLoadConvention(lc)}
                  />
                ))}
              </View>
              <ExpandableSection title="Descanso padrão e observações">
                <Field
                  label="Descanso padrão (segundos)"
                  value={defaultRest}
                  onChangeText={setDefaultRest}
                  keyboardType="numeric"
                />
                <Field
                  label="Observações"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Ajuste de banco, pegada ou observações"
                />
              </ExpandableSection>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Salvar" busy={action.busy} onPress={() => void saveExercise()} />
                <Button title="Cancelar" secondary onPress={() => setFormOpen(false)} />
              </View>
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Cadastrados ({filtered.length})</Txt>
            {filtered.length ? (
              filtered.map((ex) => (
                <CompactRow
                  key={ex.id}
                  title={`${ex.name}${ex.archived ? ' (Arquivado)' : ''}`}
                  subtitle={`${muscleGroupLabels[ex.muscleGroup]}${ex.equipment ? ` · ${ex.equipment}` : ''} · ${loadConventionLabels[ex.loadConvention]}`}
                  onPress={() => setSelectedExercise(ex)}
                />
              ))
            ) : (
              <Txt kind="muted">Nenhum exercício encontrado.</Txt>
            )}
          </Card>
        </>
      )}

      <ActionSheetModal
        visible={Boolean(selectedExercise)}
        title={selectedExercise?.name ?? ''}
        subtitle={
          selectedExercise
            ? `${muscleGroupLabels[selectedExercise.muscleGroup]} · ${loadConventionLabels[selectedExercise.loadConvention]}`
            : ''
        }
        onClose={() => setSelectedExercise(null)}
        actions={
          selectedExercise
            ? [
                {
                  label: 'Editar exercício',
                  onPress: () => {
                    const ex = selectedExercise;
                    setSelectedExercise(null);
                    startEdit(ex);
                  },
                },
                {
                  label: selectedExercise.archived ? 'Reativar exercício' : 'Arquivar exercício',
                  destructive: !selectedExercise.archived,
                  onPress: () => {
                    const ex = selectedExercise;
                    setSelectedExercise(null);
                    if (!training || !profileId) return;
                    void action.run(
                      async () => {
                        await training.setExerciseArchived(profileId, ex.id, !ex.archived);
                        recordsChanged();
                      },
                      ex.archived ? 'Exercício reativado.' : 'Exercício arquivado.',
                    );
                  },
                },
              ]
            : []
        }
      />

      <ActionSheetModal
        visible={seedConfirmOpen}
        title="Importar catálogo inicial"
        subtitle="Adiciona 9 exercícios essenciais e fichas iniciais de Readaptação e Treino A/B. Nenhuma sessão será criada."
        onClose={() => setSeedConfirmOpen(false)}
        actions={[
          {
            label: 'Confirmar importação',
            onPress: () => {
              setSeedConfirmOpen(false);
              if (!training || !profileId) return;
              void action.run(async () => {
                await training.applySeedBundle(profileId, buildTrainingSeedBundle(randomUUID));
                recordsChanged();
              }, 'Catálogo e fichas iniciais importados.');
            },
          },
        ]}
      />
    </Screen>
  );
}
