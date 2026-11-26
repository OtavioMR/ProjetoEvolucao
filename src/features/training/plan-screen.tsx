import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActionSheetModal,
  Button,
  Card,
  CompactRow,
  Field,
  Header,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import type { PlanDaySlot, TrainingPlanVersion } from '../../domain/training/training';
import { LoadState } from '../diary/components';
import { useAction } from '../diary/use-diary';
import { useTraining } from './use-training';

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function emptySlots(): PlanDaySlot[] {
  return weekdayNames.map((_, dayOfWeek) => ({ dayOfWeek, kind: 'rest', templateId: null }));
}

export function PlanScreen() {
  const { data, snapshot, selectedDate, training, recordsChanged, error, retry } = useTraining();
  const action = useAction();
  const profileId = snapshot?.profile.id;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('Agenda semanal');
  const [fromDate, setFromDate] = useState(selectedDate);
  const [toDate, setToDate] = useState('');
  const [slots, setSlots] = useState<PlanDaySlot[]>(emptySlots());
  const [formOpen, setFormOpen] = useState(false);
  const [slotDayPicker, setSlotDayPicker] = useState<number | null>(null);

  const activeTemplates = data?.library.templates.filter((t) => !t.archived) ?? [];
  const templateById = new Map(activeTemplates.map((t) => [t.id, t]));

  function startCreate() {
    setEditingId(null);
    setName('Agenda semanal');
    setFromDate(selectedDate);
    setToDate('');
    setSlots(emptySlots());
    setFormOpen(true);
  }

  function startEdit(version: TrainingPlanVersion) {
    setEditingId(version.id);
    setName(version.name);
    setFromDate(version.effectiveFromDate);
    setToDate(version.effectiveToDate ?? '');
    setSlots(version.slots);
    setFormOpen(true);
  }

  async function savePlan() {
    if (!training || !profileId) return;
    const ok = await action.run(async () => {
      await training.savePlanVersion(profileId, {
        id: editingId ?? randomUUID(),
        name,
        effectiveFromDate: fromDate.trim(),
        effectiveToDate: toDate.trim() ? toDate.trim() : null,
        slots,
        notes: '',
      });
      recordsChanged();
    }, 'Agenda versionada salva.');
    if (ok) setFormOpen(false);
  }

  return (
    <Screen>
      <Header
        eyebrow="Treinos / Agenda"
        title="Agenda versionada"
        description="Defina vigências sem sobreposição e distribua treinos ou descanso na semana."
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}

      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Button title="Nova versão de agenda" icon="add-outline" onPress={startCreate} />
          </Card>

          {formOpen ? (
            <Card>
              <Txt kind="heading">{editingId ? 'Editar agenda' : 'Nova versão'}</Txt>
              <Field label="Nome da versão" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Início (AAAA-MM-DD)"
                    value={fromDate}
                    onChangeText={setFromDate}
                    placeholder="2026-11-26"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Fim opcional"
                    value={toDate}
                    onChangeText={setToDate}
                    placeholder="Em aberto"
                  />
                </View>
              </View>
              <Txt kind="label">Dias da semana</Txt>
              {slots.map((slot) => {
                const tpl = slot.templateId ? templateById.get(slot.templateId) : null;
                return (
                  <CompactRow
                    key={slot.dayOfWeek}
                    title={weekdayNames[slot.dayOfWeek]!}
                    subtitle={
                      slot.kind === 'rest' ? 'Descanso' : (tpl?.name ?? 'Ficha não selecionada')
                    }
                    onPress={() => setSlotDayPicker(slot.dayOfWeek)}
                  />
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Salvar agenda" busy={action.busy} onPress={() => void savePlan()} />
                <Button title="Cancelar" secondary onPress={() => setFormOpen(false)} />
              </View>
            </Card>
          ) : null}

          <Card>
            <Txt kind="eyebrow">Versões ({data.library.planVersions.length})</Txt>
            {data.library.planVersions.length ? (
              data.library.planVersions.map((pv) => (
                <Card key={pv.id}>
                  <Txt kind="heading">{pv.name}</Txt>
                  <Txt kind="muted">
                    Vigência: {pv.effectiveFromDate} até {pv.effectiveToDate ?? 'indeterminado'}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Editar" secondary compact onPress={() => startEdit(pv)} />
                    <Button
                      title="Excluir"
                      secondary
                      compact
                      onPress={() => {
                        if (!training || !profileId) return;
                        void action.run(async () => {
                          await training.deletePlanVersion(profileId, pv.id);
                          recordsChanged();
                        }, 'Versão removida.');
                      }}
                    />
                  </View>
                </Card>
              ))
            ) : (
              <Txt kind="muted">Nenhuma agenda versionada configurada.</Txt>
            )}
          </Card>
        </>
      )}

      <ActionSheetModal
        visible={slotDayPicker !== null}
        title={slotDayPicker !== null ? weekdayNames[slotDayPicker]! : ''}
        subtitle="Defina descanso ou escolha uma ficha ativa."
        onClose={() => setSlotDayPicker(null)}
        actions={[
          {
            label: 'Descanso',
            onPress: () => {
              const day = slotDayPicker;
              setSlotDayPicker(null);
              if (day === null) return;
              setSlots((prev) =>
                prev.map((s) =>
                  s.dayOfWeek === day ? { ...s, kind: 'rest', templateId: null } : s,
                ),
              );
            },
          },
          ...activeTemplates.map((tpl) => ({
            label: tpl.name,
            onPress: () => {
              const day = slotDayPicker;
              setSlotDayPicker(null);
              if (day === null) return;
              setSlots((prev) =>
                prev.map((s) =>
                  s.dayOfWeek === day ? { ...s, kind: 'template', templateId: tpl.id } : s,
                ),
              );
            },
          })),
        ]}
      />
    </Screen>
  );
}
