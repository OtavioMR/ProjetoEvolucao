import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { Catalog } from '../../core/database/repositories/diary-repository';
import { eventInstant, localTimeAt } from '../../core/date-time/event-time';
import { mealSchema, type Meal } from '../../domain/nutrition/nutrition';
import { parseOptionalNumber } from '../../domain/profile/profile';
import {
  Button,
  Choice,
  ExpandableSection,
  Field,
  Header,
  Notice,
  Screen,
  Txt,
} from '../../shared/components/ui';
import { LoadState, NutritionSummary } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';
import { ItemBuilder } from './item-builder';

function MealForm({ initial, catalog, copy }: { initial: Meal; catalog: Catalog; copy: boolean }) {
  const { snapshot, diary, recordsChanged } = useDiary();
  const router = useRouter();
  const action = useAction();
  const [items, setItems] = useState(initial.items);
  const [mealType, setMealType] = useState(initial.mealType);
  const [context, setContext] = useState<Meal['context']>(initial.context);
  const [validation, setValidation] = useState('');
  const { control, setValue } = useForm({
    defaultValues: {
      title: initial.title,
      date: initial.localDate,
      time: localTimeAt(new Date(initial.occurredAt), initial.timezone),
      notes: initial.notes,
      hunger: initial.hunger?.toString() ?? '',
      satiety: initial.satiety?.toString() ?? '',
    },
  });
  const values = useWatch({ control, compute: (fields) => fields });
  return (
    <>
      <Txt kind="label">Tipo de refeição</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...new Set([...snapshot!.preferences.meals.map((m) => m.name), 'Outras', mealType])].map(
          (name) => (
            <Choice
              key={name}
              label={name}
              selected={mealType === name}
              onPress={() => setMealType(name)}
            />
          ),
        )}
      </View>
      <Field
        label="Título da refeição"
        value={values.title}
        onChangeText={(v) => setValue('title', v)}
      />
      {catalog.templates.length > 0 ? (
        <ExpandableSection
          title={`Usar um modelo (${catalog.templates.length})`}
          summary="Adiciona os itens salvos para você revisar"
        >
          {catalog.templates.map((t) => (
            <Button
              key={t.id}
              secondary
              title={`Usar modelo ${t.name}`}
              onPress={() =>
                setItems([...items, ...t.items.map((i) => ({ ...i, id: randomUUID() }))])
              }
            />
          ))}
        </ExpandableSection>
      ) : null}
      <ItemBuilder catalog={catalog} items={items} onChange={setItems} />
      <NutritionSummary items={items} />
      <ExpandableSection
        title="Data e horário"
        summary={`${values.date.split('-').reverse().join('/')} · ${values.time}`}
        defaultOpen={copy}
      >
        <Field
          label="Data da refeição (AAAA-MM-DD)"
          value={values.date}
          onChangeText={(v) => setValue('date', v)}
        />
        <Field
          label="Horário da refeição (HH:mm)"
          value={values.time}
          onChangeText={(v) => setValue('time', v)}
          keyboardType="numbers-and-punctuation"
        />
        <Txt kind="muted">
          Fuso deste registro: {initial.timezone}. Ao corrigir a data, o instante UTC é recalculado
          junto com o dia civil.
        </Txt>
      </ExpandableSection>
      <ExpandableSection
        title="Mais detalhes (opcional)"
        summary="Fome, saciedade, contexto e observações"
        defaultOpen={Boolean(
          initial.hunger !== null || initial.satiety !== null || initial.context || initial.notes,
        )}
      >
        <Field
          label="Fome antes (0 a 10, opcional)"
          value={values.hunger}
          onChangeText={(v) => setValue('hunger', v)}
          keyboardType="number-pad"
          hint="Em branco significa que prefere não responder."
        />
        <Field
          label="Saciedade depois (0 a 10, opcional)"
          value={values.satiety}
          onChangeText={(v) => setValue('satiety', v)}
          keyboardType="number-pad"
        />
        <Txt kind="label">Contexto opcional</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['', 'fome', 'tédio', 'rotina', 'social', 'estresse', 'outro'] as const).map((c) => (
            <Choice
              key={c}
              label={c || 'Não responder'}
              selected={context === c}
              onPress={() => setContext(c)}
            />
          ))}
        </View>
        <Field
          label="Observações da refeição (opcional)"
          multiline
          value={values.notes}
          onChangeText={(v) => setValue('notes', v)}
        />
      </ExpandableSection>
      {validation ? <Notice error>{validation}</Notice> : null}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      <Button
        title={copy ? 'Salvar cópia da refeição' : 'Salvar refeição'}
        busy={action.busy}
        onPress={() => {
          try {
            const meal = mealSchema.parse({
              ...initial,
              title: values.title,
              mealType,
              localDate: values.date,
              occurredAt: eventInstant(
                values.date,
                values.time,
                initial.timezone,
                initial.occurredAt,
              ),
              hunger: parseOptionalNumber(values.hunger),
              satiety: parseOptionalNumber(values.satiety),
              context,
              notes: values.notes,
              items,
            });
            setValidation('');
            void action.run(async () => {
              await diary!.saveMeal(snapshot!.profile.id, meal);
              recordsChanged();
              router.back();
            });
          } catch (e) {
            setValidation(
              e instanceof Error && !('issues' in e)
                ? e.message
                : 'Revise título, data, horários e itens. Fome e saciedade devem ser inteiros entre 0 e 10.',
            );
          }
        }}
      />
    </>
  );
}

export function MealEditorScreen() {
  const { id, copy } = useLocalSearchParams<{ id?: string; copy?: string }>();
  const { data, snapshot, selectedDate, error, retry } = useDiary();
  const [newId] = useState(randomUUID);
  const [clonedIds] = useState(() => new Map<string, string>());
  const existing = data?.meals.find((m) => m.id === id);
  const timezone = snapshot!.profile.timezone;
  const now = new Date();
  let initial: Meal | undefined;
  if (!id)
    initial = {
      id: newId,
      localDate: selectedDate,
      occurredAt: eventInstant(selectedDate, localTimeAt(now, timezone), timezone),
      timezone,
      title: snapshot!.preferences.meals[0]!.name,
      mealType: snapshot!.preferences.meals[0]!.name,
      hunger: null,
      satiety: null,
      context: '',
      notes: '',
      items: [],
    };
  else if (existing)
    initial = copy
      ? {
          ...existing,
          id: newId,
          items: existing.items.map((i) => {
            if (!clonedIds.has(i.id)) clonedIds.set(i.id, randomUUID());
            return { ...i, id: clonedIds.get(i.id)! };
          }),
        }
      : existing;
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Alimentação / Diário"
        title={copy ? 'Repetir refeição.' : id ? 'Corrigir refeição.' : 'Registrar refeição.'}
        description={
          copy
            ? 'Revise a data e as porções antes de salvar. A cópia terá seus próprios registros.'
            : 'Registre o que fizer sentido para você, com ou sem nutrientes.'
        }
      />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : initial ? (
        <MealForm key={initial.id} initial={initial} catalog={data.catalog} copy={!!copy} />
      ) : (
        <Notice error>
          Refeição não encontrada neste dia. Volte ao diário para consultar a data correta.
        </Notice>
      )}
    </Screen>
  );
}
