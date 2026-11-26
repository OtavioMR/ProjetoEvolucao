import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { eventInstant, localTimeAt } from '../../core/date-time/event-time';
import { waterSchema, type WaterEntry } from '../../domain/nutrition/nutrition';
import { parseOptionalNumber } from '../../domain/profile/profile';
import { useApp } from '../../shared/app-provider';
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
import { DateSelector, LoadState, numberText } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';

export function WaterQuickActions() {
  const { diary, snapshot, selectedDate, recordsChanged } = useApp();
  const [last, setLast] = useState<{ id: string; date: string } | null>(null);
  const pending = useRef<{ key: string; entry: WaterEntry } | null>(null);
  const action = useAction();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {snapshot!.preferences.quickWaterAmounts.map((amount, index) => (
          <Button
            key={`${amount}-${index}`}
            compact
            title={`+ ${numberText(amount)} mL`}
            accessibilityLabel={`Adicionar ${numberText(amount)} mL de água`}
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                const key = `${selectedDate}:${amount}`;
                if (pending.current?.key !== key) {
                  const timezone = snapshot!.profile.timezone;
                  pending.current = {
                    key,
                    entry: {
                      id: randomUUID(),
                      localDate: selectedDate,
                      timezone,
                      occurredAt: eventInstant(
                        selectedDate,
                        localTimeAt(new Date(), timezone),
                        timezone,
                      ),
                      amountMl: amount,
                      beverage: 'water',
                      notes: '',
                    },
                  };
                }
                const entry = pending.current!.entry;
                await diary!.saveWater(snapshot!.profile.id, entry);
                pending.current = null;
                setLast({ id: entry.id, date: entry.localDate });
                recordsChanged();
              }, 'Água registrada no dia selecionado.')
            }
          />
        ))}
      </View>
      {last ? (
        <Button
          secondary
          title={`Desfazer último copo (${last.date.split('-').reverse().join('/')})`}
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await diary!.deleteWater(snapshot!.profile.id, last.id);
              setLast(null);
              recordsChanged();
            }, 'Último copo removido.')
          }
        />
      ) : null}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
    </View>
  );
}

function WaterEditor({ initial, close }: { initial: WaterEntry; close: () => void }) {
  const { diary, snapshot, recordsChanged } = useApp();
  const { control, setValue } = useForm({
    defaultValues: {
      amount: String(initial.amountMl),
      date: initial.localDate,
      time: localTimeAt(new Date(initial.occurredAt), initial.timezone),
      notes: initial.notes,
    },
  });
  const values = useWatch({ control, compute: (fields) => fields });
  const [beverage, setBeverage] = useState(initial.beverage);
  const [error, setError] = useState('');
  const action = useAction();
  return (
    <Card>
      <Field
        label="Volume (mL)"
        value={values.amount}
        onChangeText={(v) => setValue('amount', v)}
        keyboardType="number-pad"
      />
      <Field
        label="Data da bebida (AAAA-MM-DD)"
        value={values.date}
        onChangeText={(v) => setValue('date', v)}
      />
      <Field
        label="Horário da bebida (HH:mm)"
        value={values.time}
        onChangeText={(v) => setValue('time', v)}
      />
      <Txt kind="muted">Fuso do registro: {initial.timezone}</Txt>
      <Choice
        label="Água pura"
        selected={beverage === 'water'}
        onPress={() => setBeverage('water')}
      />
      <Choice
        label="Outra bebida (fora do total de água)"
        selected={beverage === 'other'}
        onPress={() => setBeverage('other')}
      />
      <Field
        label="Observação da bebida"
        value={values.notes}
        onChangeText={(v) => setValue('notes', v)}
      />
      {error ? <Notice error>{error}</Notice> : null}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      <Button
        title="Salvar bebida"
        busy={action.busy}
        onPress={() => {
          try {
            const entry = waterSchema.parse({
              ...initial,
              amountMl: parseOptionalNumber(values.amount),
              localDate: values.date,
              occurredAt: eventInstant(
                values.date,
                values.time,
                initial.timezone,
                initial.occurredAt,
              ),
              beverage,
              notes: values.notes,
            });
            setError('');
            void action.run(async () => {
              await diary!.saveWater(snapshot!.profile.id, entry);
              recordsChanged();
              close();
            });
          } catch {
            setError(
              'Confira data, horário e volume inteiro positivo, até 10.000 mL por registro.',
            );
          }
        }}
      />
      <Button secondary title="Fechar edição da bebida" busy={action.busy} onPress={close} />
    </Card>
  );
}

export function HydrationScreen() {
  const { data, snapshot, selectedDate, diary, recordsChanged, error, retry } = useDiary();
  const [editing, setEditing] = useState<WaterEntry | null>(null);
  const [menuEntry, setMenuEntry] = useState<WaterEntry | null>(null);
  const action = useAction();
  const total = data?.water
    .filter((w) => w.beverage === 'water')
    .reduce((sum, w) => sum + w.amountMl, 0);
  const count = data?.water.filter((w) => w.beverage === 'water').length ?? 0;
  const goal = snapshot!.goals.find(
    (g) =>
      g.metric === 'water' &&
      g.enabled &&
      g.effectiveFromDate <= selectedDate &&
      (!g.effectiveToDate || g.effectiveToDate >= selectedDate),
  );
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Mais / Água"
        title="Sua hidratação."
        description="Cada copo é um registro. Outras bebidas ficam fora do total de água pura."
      />
      <DateSelector key={selectedDate} />
      <Card>
        <Txt kind="heading">
          {count ? `${numberText(total!)} mL registrados` : 'Água não registrada'}
        </Txt>
        {goal ? (
          <Txt kind="muted">Referência flexível do dia: {numberText(goal.targetValue)} mL</Txt>
        ) : null}
        <WaterQuickActions />
      </Card>
      <Button
        secondary
        title="Outro volume ou bebida"
        onPress={() => {
          const timezone = snapshot!.profile.timezone;
          setEditing({
            id: randomUUID(),
            localDate: selectedDate,
            occurredAt: eventInstant(selectedDate, localTimeAt(new Date(), timezone), timezone),
            timezone,
            amountMl: 250,
            beverage: 'water',
            notes: '',
          });
        }}
      />
      {editing ? (
        <WaterEditor key={editing.id} initial={editing} close={() => setEditing(null)} />
      ) : null}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : data.water.length ? (
        <Card>
          <Txt kind="heading">Registros do dia</Txt>
          {data.water.map((w, index) => {
            const time = localTimeAt(new Date(w.occurredAt), w.timezone);
            return (
              <CompactRow
                key={w.id}
                last={index === data.water.length - 1}
                title={`${numberText(w.amountMl)} mL · ${w.beverage === 'water' ? 'Água' : 'Outra bebida'}`}
                subtitle={w.notes ? `${time} · ${w.notes}` : time}
                onPress={() => setEditing(w)}
                right={
                  <IconButton
                    icon="ellipsis-horizontal"
                    label={`Ações da bebida de ${time}`}
                    busy={action.busy}
                    onPress={() => setMenuEntry(w)}
                  />
                }
              />
            );
          })}
        </Card>
      ) : (
        <Notice>Nenhuma bebida registrada nesta data.</Notice>
      )}
      <ActionSheetModal
        visible={!!menuEntry}
        title={
          menuEntry
            ? `${numberText(menuEntry.amountMl)} mL · ${menuEntry.beverage === 'water' ? 'Água' : 'Outra bebida'}`
            : ''
        }
        subtitle={
          menuEntry ? localTimeAt(new Date(menuEntry.occurredAt), menuEntry.timezone) : undefined
        }
        onClose={() => setMenuEntry(null)}
        actions={
          menuEntry
            ? [
                {
                  label: 'Editar bebida',
                  icon: 'create-outline',
                  onPress: () => setEditing(menuEntry),
                },
                {
                  label: 'Excluir esta bebida',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () =>
                    Alert.alert(
                      'Excluir registro de bebida?',
                      'Somente este lançamento será removido.',
                      [
                        { text: 'Manter', style: 'cancel' },
                        {
                          text: 'Excluir',
                          style: 'destructive',
                          onPress: () =>
                            void action.run(async () => {
                              await diary!.deleteWater(snapshot!.profile.id, menuEntry.id);
                              recordsChanged();
                            }),
                        },
                      ],
                    ),
                },
              ]
            : []
        }
      />
    </Screen>
  );
}
