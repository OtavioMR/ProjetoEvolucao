import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from 'react-native';
import {
  recipeSchema,
  snapshotFood,
  templateSchema,
  type MealItem,
  type MealTemplate,
  type Recipe,
} from '../../domain/nutrition/nutrition';
import { parseOptionalNumber } from '../../domain/profile/profile';
import {
  Button,
  Card,
  Choice,
  Field,
  Header,
  Notice,
  Screen,
  Toggle,
  Txt,
} from '../../shared/components/ui';
import { LoadState, NutritionSummary } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';
import { ItemBuilder } from './item-builder';

type Draft = {
  id: string;
  name: string;
  items: MealItem[];
  yieldQuantity: number;
  yieldUnit: 'g' | 'portion';
  notes: string;
  archived: boolean;
};
function CollectionEditor({
  initial,
  isRecipe,
  close,
}: {
  initial: Draft;
  isRecipe: boolean;
  close: () => void;
}) {
  const { data, diary, snapshot, recordsChanged } = useDiary();
  const { control, setValue } = useForm({
    defaultValues: {
      name: initial.name,
      yield: String(initial.yieldQuantity),
      notes: initial.notes,
    },
  });
  const values = useWatch({ control, compute: (fields) => fields });
  const [unit, setUnit] = useState(initial.yieldUnit);
  const [archived, setArchived] = useState(initial.archived);
  const [items, setItems] = useState(initial.items);
  const [error, setError] = useState('');
  const action = useAction();
  if (!data) return <Txt>Carregando catálogo…</Txt>;
  return (
    <>
      <Field
        label={isRecipe ? 'Nome da receita' : 'Nome do modelo'}
        value={values.name}
        onChangeText={(v) => setValue('name', v)}
      />
      <ItemBuilder
        catalog={data.catalog}
        items={items}
        onChange={setItems}
        allowRecipes={!isRecipe}
      />
      <NutritionSummary items={items} />
      {isRecipe ? (
        <>
          <Notice>
            Informe o rendimento final depois do preparo ou o número de porções. O peso dos
            ingredientes crus não define o peso final cozido. Nutrientes faltantes geram estimativa
            parcial.
          </Notice>
          <Field
            label="Rendimento final da receita"
            value={values.yield}
            onChangeText={(v) => setValue('yield', v)}
            keyboardType="decimal-pad"
          />
          <Choice label="Peso final em g" selected={unit === 'g'} onPress={() => setUnit('g')} />
          <Choice
            label="Número de porções"
            selected={unit === 'portion'}
            onPress={() => setUnit('portion')}
          />
          <Field
            label="Observação da receita"
            value={values.notes}
            onChangeText={(v) => setValue('notes', v)}
            multiline
          />
          <Toggle
            title="Arquivar receita"
            detail="Mantém os registros anteriores."
            value={archived}
            onChange={setArchived}
          />
        </>
      ) : (
        <Notice>
          Salvar um modelo não registra consumo. Você revisa a quantidade e confirma a refeição ao
          usá-lo.
        </Notice>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      <Button
        title={isRecipe ? 'Salvar receita' : 'Salvar modelo'}
        busy={action.busy}
        onPress={() => {
          try {
            const value = {
              ...initial,
              name: values.name,
              items,
              yieldQuantity: parseOptionalNumber(values.yield),
              yieldUnit: unit,
              notes: values.notes,
              archived,
            };
            const parsed = isRecipe ? recipeSchema.parse(value) : templateSchema.parse(value);
            setError('');
            void action.run(async () => {
              if (isRecipe) await diary!.saveRecipe(snapshot!.profile.id, parsed as Recipe);
              else await diary!.saveTemplate(snapshot!.profile.id, parsed as MealTemplate);
              recordsChanged();
              close();
            });
          } catch {
            setError(
              'Informe nome, pelo menos um item e, para receitas, rendimento final positivo.',
            );
          }
        }}
      />
      <Button secondary title="Voltar à lista" busy={action.busy} onPress={close} />
    </>
  );
}

export function CollectionsScreen({ isRecipe }: { isRecipe: boolean }) {
  const { data, diary, snapshot, recordsChanged, error, retry } = useDiary();
  const [draft, setDraft] = useState<Draft | null>(null);
  const starterTemplates = useRef<MealTemplate[] | null>(null);
  const action = useAction();
  const edit = (value?: Recipe | MealTemplate) =>
    setDraft({
      id: value?.id ?? randomUUID(),
      name: value?.name ?? '',
      items: value?.items ?? [],
      yieldQuantity: value && 'yieldQuantity' in value ? value.yieldQuantity : 1,
      yieldUnit: value && 'yieldUnit' in value ? value.yieldUnit : 'portion',
      notes: value && 'notes' in value ? value.notes : '',
      archived: value && 'archived' in value ? value.archived : false,
    });
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Alimentação"
        title={isRecipe ? 'Receitas caseiras.' : 'Modelos de refeição.'}
        description={
          isRecipe
            ? 'Ingredientes em snapshots e rendimento final explícito.'
            : 'Combinações que você revisa antes de registrar.'
        }
      />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : draft ? (
        <CollectionEditor
          key={draft.id}
          initial={draft}
          isRecipe={isRecipe}
          close={() => setDraft(null)}
        />
      ) : (
        <>
          <Button title={isRecipe ? 'Criar receita' : 'Criar modelo'} onPress={() => edit()} />
          {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
          {!isRecipe && !data.catalog.templates.length && data.catalog.foods.length ? (
            <Button
              secondary
              title="Adicionar sugestões editáveis de modelos"
              busy={action.busy}
              onPress={() =>
                void action.run(async () => {
                  const groups = [
                    ['Café', 'Pão francês', 'Ovo', 'Banana', 'Café'],
                    ['Almoço', 'Arroz branco', 'Feijão', 'Frango', 'Legumes'],
                    ['Lanche', 'Iogurte', 'Banana', 'Aveia'],
                    ['Jantar', 'Arroz branco', 'Feijão', 'Carne', 'Legumes'],
                    ['Ceia', 'Pão francês', 'Ovo', 'Leite'],
                  ];
                  if (!starterTemplates.current)
                    starterTemplates.current = groups.flatMap(([name, ...names]) => {
                      const items = names.flatMap((n) => {
                        const f = data.catalog.foods.find((f) => f.name === n && !f.archived);
                        return f ? [snapshotFood(f, randomUUID(), 1, 'portion')] : [];
                      });
                      return items.length
                        ? [
                            {
                              id: randomUUID(),
                              name: name!,
                              items,
                            },
                          ]
                        : [];
                    });
                  if (!starterTemplates.current.length)
                    throw new Error('Nenhum alimento das sugestões foi cadastrado.');
                  await diary!.saveTemplates(snapshot!.profile.id, starterTemplates.current);
                  recordsChanged();
                }, 'Sugestões salvas como modelos editáveis. Revise as porções antes de usar.')
              }
            />
          ) : null}
          {(isRecipe ? data.catalog.recipes : data.catalog.templates).map((value) => (
            <Card key={value.id}>
              <Txt kind="heading">
                {value.name}
                {'archived' in value && value.archived ? ' · arquivada' : ''}
              </Txt>
              <Txt kind="muted">
                {value.items.length} ingrediente(s)/item(ns)
                {'yieldQuantity' in value
                  ? ` · rendimento ${value.yieldQuantity} ${'yieldUnit' in value && value.yieldUnit === 'g' ? 'g' : 'porção(ões)'}`
                  : ''}
              </Txt>
              <Button secondary title={`Editar ${value.name}`} onPress={() => edit(value)} />
              {!isRecipe ? (
                <Button
                  secondary
                  title={`Excluir modelo ${value.name}`}
                  onPress={() =>
                    Alert.alert('Excluir modelo?', 'As refeições registradas serão preservadas.', [
                      { text: 'Manter', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: () =>
                          void action.run(async () => {
                            await diary!.deleteTemplate(snapshot!.profile.id, value.id);
                            recordsChanged();
                          }),
                      },
                    ])
                  }
                />
              ) : null}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
