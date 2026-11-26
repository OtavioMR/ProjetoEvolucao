import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import {
  foodSchema,
  nutrientKeys,
  unknownNutrients,
  unitLabels,
  type Food,
  type Unit,
} from '../../domain/nutrition/nutrition';
import { parseOptionalNumber } from '../../domain/profile/profile';
import {
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
import { LoadState } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';

const starterNames = [
  ['Arroz branco', 'Cozido'],
  ['Feijão', 'Cozido'],
  ['Frango', ''],
  ['Carne', ''],
  ['Ovo', ''],
  ['Pão francês', ''],
  ['Banana', ''],
  ['Leite', ''],
  ['Aveia', ''],
  ['Iogurte', ''],
  ['Legumes', ''],
  ['Macarrão instantâneo', ''],
  ['Café', ''],
  ['Açúcar', ''],
  ['Refrigerante zero', ''],
  ['Óleo', ''],
];
export function emptyFood(name = '', preparation = ''): Food {
  return {
    id: randomUUID(),
    name,
    preparation,
    brand: '',
    referenceQuantity: 100,
    referenceUnit: 'g',
    nutrients: unknownNutrients(),
    source: '',
    sourceVersion: '',
    portions: [],
    favorite: false,
    archived: false,
  };
}

function FoodEditor({
  initial,
  save,
  close,
  busy,
}: {
  initial: Food;
  save: (food: Food) => void;
  close: () => void;
  busy: boolean;
}) {
  const { control, setValue } = useForm({
    defaultValues: {
      name: initial.name,
      preparation: initial.preparation,
      brand: initial.brand,
      reference: String(initial.referenceQuantity),
      source: initial.source,
      version: initial.sourceVersion,
      kcal: initial.nutrients.kcal?.toString() ?? '',
      protein: initial.nutrients.protein?.toString() ?? '',
      carbs: initial.nutrients.carbs?.toString() ?? '',
      fat: initial.nutrients.fat?.toString() ?? '',
      fiber: initial.nutrients.fiber?.toString() ?? '',
    },
  });
  const values = useWatch({ control, compute: (fields) => fields });
  const [unit, setUnit] = useState(initial.referenceUnit);
  const [favorite, setFavorite] = useState(initial.favorite);
  const [archived, setArchived] = useState(initial.archived);
  const [portions, setPortions] = useState(initial.portions);
  const [portionName, setPortionName] = useState('');
  const [portionQuantity, setPortionQuantity] = useState('1');
  const [baseQuantity, setBaseQuantity] = useState('');
  const [portionUnit, setPortionUnit] = useState<Unit>('portion');
  const [error, setError] = useState('');
  return (
    <>
      <Field
        label="Nome do alimento"
        value={values.name}
        onChangeText={(v) => setValue('name', v)}
      />
      <Field
        label="Preparo (cru, cozido, frito…)"
        value={values.preparation}
        onChangeText={(v) => setValue('preparation', v)}
      />
      <Field
        label="Quantidade de referência"
        value={values.reference}
        onChangeText={(v) => setValue('reference', v)}
        keyboardType="decimal-pad"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(unitLabels) as Unit[]).map((u) => (
          <Choice key={u} label={unitLabels[u]} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </View>
      <Notice>
        Deixe em branco o que não souber. Use zero apenas quando a fonte declarar zero. Valores
        devem corresponder à quantidade de referência acima.
      </Notice>
      {nutrientKeys.map((key) => (
        <Field
          key={key}
          label={
            {
              kcal: 'Energia (kcal)',
              protein: 'Proteínas (g)',
              carbs: 'Carboidratos (g)',
              fat: 'Gorduras (g)',
              fiber: 'Fibras (g)',
            }[key]
          }
          value={values[key]}
          onChangeText={(v) => setValue(key, v)}
          keyboardType="decimal-pad"
        />
      ))}
      <ExpandableSection
        title="Marca, fonte e opções"
        summary="Origem dos nutrientes, favorito e arquivamento"
        defaultOpen={Boolean(
          values.brand || values.source || values.version || favorite || archived,
        )}
      >
        <Field
          label="Marca (opcional)"
          value={values.brand}
          onChangeText={(v) => setValue('brand', v)}
        />
        <Field
          label="Fonte dos nutrientes"
          hint="Ex.: rótulo confirmado ou identificação da tabela consultada."
          value={values.source}
          onChangeText={(v) => setValue('source', v)}
        />
        <Field
          label="Data ou versão da fonte (opcional)"
          value={values.version}
          onChangeText={(v) => setValue('version', v)}
        />
        <Toggle title="Favorito" value={favorite} onChange={setFavorite} />
        <Toggle
          title="Arquivar alimento"
          detail="Oculta da busca e preserva o histórico."
          value={archived}
          onChange={setArchived}
        />
      </ExpandableSection>
      <ExpandableSection
        title={`Equivalências (${portions.length})`}
        summary="Medidas caseiras ou porções deste alimento"
        defaultOpen={portions.length > 0}
      >
        {portions.map((p) => (
          <View key={p.id} style={{ gap: 8 }}>
            <Txt>
              {p.label}: {p.quantity} {unitLabels[p.unit]} = {p.baseQuantity}{' '}
              {unitLabels[p.baseUnit]}
            </Txt>
            <Button
              secondary
              title={`Remover equivalência ${p.label}`}
              onPress={() => setPortions(portions.filter((i) => i.id !== p.id))}
            />
          </View>
        ))}
        <Field
          label="Nome da equivalência"
          value={portionName}
          onChangeText={setPortionName}
          placeholder="Ex.: uma colher"
        />
        <Field
          label="Quantidade de unidades ou porções"
          value={portionQuantity}
          onChangeText={setPortionQuantity}
          keyboardType="decimal-pad"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(unitLabels) as Unit[]).map((u) => (
            <Choice
              key={u}
              label={`Equivalência em ${unitLabels[u]}`}
              selected={portionUnit === u}
              onPress={() => setPortionUnit(u)}
            />
          ))}
        </View>
        <Field
          label={`Equivale a quanto em ${unitLabels[unit]}?`}
          value={baseQuantity}
          onChangeText={setBaseQuantity}
          keyboardType="decimal-pad"
        />
        <Button
          secondary
          title="Adicionar equivalência"
          onPress={() => {
            const next = {
              id: randomUUID(),
              label: portionName,
              unit: portionUnit,
              quantity: parseOptionalNumber(portionQuantity) ?? NaN,
              baseQuantity: parseOptionalNumber(baseQuantity) ?? NaN,
              baseUnit: unit,
            };
            try {
              foodSchema.parse({ ...initial, portions: [...portions, next] });
              setPortions([...portions, next]);
              setPortionName('');
              setBaseQuantity('');
              setError('');
            } catch {
              setError('Confira nome e quantidades da equivalência.');
            }
          }}
        />
      </ExpandableSection>
      {error ? <Notice error>{error}</Notice> : null}
      <Button
        title="Salvar alimento"
        busy={busy}
        onPress={() => {
          const nutrients = { ...initial.nutrients };
          for (const key of nutrientKeys) nutrients[key] = parseOptionalNumber(values[key]);
          const result = foodSchema.safeParse({
            ...initial,
            name: values.name,
            preparation: values.preparation,
            brand: values.brand,
            referenceQuantity: parseOptionalNumber(values.reference),
            referenceUnit: unit,
            nutrients,
            source: values.source,
            sourceVersion: values.version,
            portions,
            favorite,
            archived,
          });
          if (!result.success) setError(result.error.issues[0]?.message ?? 'Revise os campos.');
          else {
            setError('');
            save(result.data);
          }
        }}
      />
      <Button secondary title="Voltar ao catálogo" busy={busy} onPress={close} />
    </>
  );
}

export function CatalogScreen() {
  const { data, error, retry, diary, snapshot, recordsChanged } = useDiary();
  const action = useAction();
  const [editing, setEditing] = useState<Food | null>(null);
  const [query, setQuery] = useState('');
  const [starterFoods] = useState(() =>
    starterNames.map(([name, preparation]) => emptyFood(name, preparation)),
  );
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Alimentação / Catálogo"
        title={editing ? 'Alimento' : 'Seu catálogo offline.'}
        description="Editar o catálogo preserva os nutrientes das refeições já registradas."
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : editing ? (
        <FoodEditor
          key={editing.id}
          initial={editing}
          busy={action.busy}
          close={() => setEditing(null)}
          save={(food) =>
            void action.run(async () => {
              await diary!.saveFood(snapshot!.profile.id, food);
              recordsChanged();
              setEditing(null);
            })
          }
        />
      ) : (
        <>
          <Button title="Cadastrar alimento" onPress={() => setEditing(emptyFood())} />
          {!data.catalog.foods.length ? (
            <>
              <Notice>
                Seu catálogo está vazio. As sugestões contêm apenas nomes e preparo; você pode
                completar os nutrientes com uma fonte verificável.
              </Notice>
              <Button
                secondary
                title="Adicionar catálogo inicial sem nutrientes"
                busy={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await diary!.saveFoods(snapshot!.profile.id, starterFoods);
                    recordsChanged();
                  })
                }
              />
            </>
          ) : null}
          <Field label="Buscar no catálogo" value={query} onChangeText={setQuery} />
          {(() => {
            const filtered = data.catalog.foods.filter((f) =>
              f.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
            );
            return filtered.length ? (
              <Card>
                {filtered.map((f, index) => {
                  const meta = [
                    f.favorite ? 'Favorito' : '',
                    f.archived ? 'Arquivado' : '',
                    f.source || '',
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <CompactRow
                      key={f.id}
                      last={index === filtered.length - 1}
                      title={`${f.name}${f.preparation ? ` · ${f.preparation}` : ''}`}
                      subtitle={meta || undefined}
                      onPress={() => setEditing(f)}
                    />
                  );
                })}
              </Card>
            ) : (
              <Notice>Nenhum alimento encontrado para essa busca.</Notice>
            );
          })()}
        </>
      )}
    </Screen>
  );
}
