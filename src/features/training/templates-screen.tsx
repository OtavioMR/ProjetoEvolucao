import { randomUUID } from 'expo-crypto';
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
  IconButton,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import {
  buildTrainingSeedBundle,
  type TemplateCategory,
  type TemplateExercise,
  type WorkoutTemplate,
} from '../../domain/training/training';
import { LoadState } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

const categoryLabels: Record<TemplateCategory, string> = {
  readaptation: 'Readaptação',
  ab: 'Treino A/B',
  custom: 'Personalizada',
};

export function TemplatesScreen() {
  const { data, snapshot, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const profileId = snapshot?.profile.id;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

  const activeExercises = data?.library.exercises.filter((e) => !e.archived) ?? [];
  const activeTemplates = data?.library.templates.filter((t) => !t.archived) ?? [];

  function startCreate() {
    setEditingId(null);
    setName('');
    setCategory('custom');
    setNotes('');
    setItems([]);
    setFormOpen(true);
  }

  function startEdit(tpl: WorkoutTemplate) {
    setEditingId(tpl.id);
    setName(tpl.name);
    setCategory(tpl.category);
    setNotes(tpl.notes);
    setItems(tpl.exercises);
    setFormOpen(true);
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next);
  }

  async function saveTemplate() {
    if (!training || !profileId) return;
    const ok = await action.run(
      async () => {
        await training.saveTemplate(profileId, {
          id: editingId ?? randomUUID(),
          name,
          category,
          notes,
          archived: false,
          exercises: items,
        });
        recordsChanged();
      },
      editingId ? 'Ficha atualizada.' : 'Ficha criada.',
    );
    if (ok) setFormOpen(false);
  }

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Fichas"
        title="Fichas de treino"
        description="Monte, reordene ou importe fichas iniciais. Editar ficha não altera treinos passados."
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button title="Nova ficha" icon="add-outline" onPress={startCreate} />
              <Button
                title="Importar Readaptação / A/B"
                secondary
                icon="download-outline"
                onPress={() => setSeedOpen(true)}
              />
            </View>
          </Card>

          {formOpen ? (
            <Card>
              <Txt kind="heading">{editingId ? 'Editar ficha' : 'Nova ficha'}</Txt>
              <Field
                label="Nome da ficha"
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Treino A"
              />
              <Txt kind="label">Categoria</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['readaptation', 'ab', 'custom'] as const).map((cat) => (
                  <Choice
                    key={cat}
                    label={categoryLabels[cat]}
                    selected={category === cat}
                    onPress={() => setCategory(cat)}
                  />
                ))}
              </View>
              <Field label="Observações" value={notes} onChangeText={setNotes} multiline />
              <Txt kind="label">Exercícios na ficha ({items.length})</Txt>
              {items.map((item, idx) => (
                <Card key={item.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Txt kind="label" style={{ flex: 1 }}>
                      {idx + 1}. {item.nameSnapshot}
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <IconButton
                        icon="arrow-up-outline"
                        label="Subir exercício"
                        onPress={() => moveItem(idx, -1)}
                      />
                      <IconButton
                        icon="arrow-down-outline"
                        label="Descer exercício"
                        onPress={() => moveItem(idx, 1)}
                      />
                      <IconButton
                        icon="trash-outline"
                        label="Remover exercício"
                        onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Séries"
                        value={String(item.targetSets)}
                        keyboardType="numeric"
                        onChangeText={(txt) => {
                          const parsed = Number.parseInt(txt || '1', 10);
                          setItems((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    targetSets: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                                  }
                                : p,
                            ),
                          );
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Faixa de reps"
                        value={item.targetRepsText}
                        onChangeText={(txt) =>
                          setItems((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, targetRepsText: txt } : p)),
                          )
                        }
                      />
                    </View>
                  </View>
                </Card>
              ))}
              <Button
                title="Adicionar exercício da biblioteca"
                secondary
                icon="add-outline"
                onPress={() => setPickerOpen(true)}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title="Salvar ficha"
                  busy={action.busy}
                  onPress={() => void saveTemplate()}
                />
                <Button title="Cancelar" secondary onPress={() => setFormOpen(false)} />
              </View>
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Fichas ativas ({activeTemplates.length})</Txt>
            {activeTemplates.length ? (
              activeTemplates.map((tpl) => (
                <CompactRow
                  key={tpl.id}
                  title={tpl.name}
                  subtitle={`${categoryLabels[tpl.category]} · ${tpl.exercises.length} exercício(s)`}
                  onPress={() => setSelectedTemplate(tpl)}
                />
              ))
            ) : (
              <Txt kind="muted">Nenhuma ficha criada ainda.</Txt>
            )}
          </Card>
        </>
      )}

      <ActionSheetModal
        visible={pickerOpen}
        title="Adicionar exercício"
        subtitle="Selecione um exercício ativo da sua biblioteca."
        onClose={() => setPickerOpen(false)}
        actions={
          activeExercises.length
            ? activeExercises.map((ex) => ({
                label: ex.name,
                onPress: () => {
                  setPickerOpen(false);
                  setItems((prev) => [
                    ...prev,
                    {
                      id: randomUUID(),
                      exerciseId: ex.id,
                      nameSnapshot: ex.name,
                      loadConvention: ex.loadConvention,
                      targetSets: 3,
                      targetRepsText: '8–12',
                      restSeconds: ex.defaultRestSeconds,
                      notes: '',
                    },
                  ]);
                },
              }))
            : [
                {
                  label: 'Fechar (cadastre exercícios primeiro)',
                  onPress: () => setPickerOpen(false),
                },
              ]
        }
      />

      <ActionSheetModal
        visible={Boolean(selectedTemplate)}
        title={selectedTemplate?.name ?? ''}
        subtitle={
          selectedTemplate
            ? `${categoryLabels[selectedTemplate.category]} · ${selectedTemplate.exercises.length} exercício(s)`
            : ''
        }
        onClose={() => setSelectedTemplate(null)}
        actions={
          selectedTemplate
            ? [
                {
                  label: 'Editar ficha',
                  onPress: () => {
                    const tpl = selectedTemplate;
                    setSelectedTemplate(null);
                    startEdit(tpl);
                  },
                },
                {
                  label: 'Arquivar ficha',
                  destructive: true,
                  onPress: () => {
                    const tpl = selectedTemplate;
                    setSelectedTemplate(null);
                    if (!training || !profileId) return;
                    void action.run(async () => {
                      await training.setTemplateArchived(profileId, tpl.id, true);
                      recordsChanged();
                    }, 'Ficha arquivada.');
                  },
                },
              ]
            : []
        }
      />

      <ActionSheetModal
        visible={seedOpen}
        title="Importar fichas iniciais"
        subtitle="Adiciona Readaptação, Treino A e Treino B junto com os exercícios base."
        onClose={() => setSeedOpen(false)}
        actions={[
          {
            label: 'Confirmar importação',
            onPress: () => {
              setSeedOpen(false);
              if (!training || !profileId) return;
              void action.run(async () => {
                await training.applySeedBundle(profileId, buildTrainingSeedBundle(randomUUID));
                recordsChanged();
              }, 'Fichas iniciais importadas.');
            },
          },
        ]}
      />
    </Screen>
  );
}
