import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import type { Catalog } from '../../core/database/repositories/diary-repository';
import {
  descriptiveItem,
  resizeItem,
  snapshotFood,
  snapshotRecipe,
  unitLabels,
  type MealItem,
  type Unit,
} from '../../domain/nutrition/nutrition';
import { parseOptionalNumber } from '../../domain/profile/profile';
import { Button, Card, Choice, Field, Notice, Txt } from '../../shared/components/ui';
import { NutritionSummary } from '../diary/components';

function ItemEditor({
  item,
  update,
  remove,
  duplicate,
}: {
  item: MealItem;
  update: (item: MealItem) => void;
  remove: () => void;
  duplicate: () => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity?.toString().replace('.', ',') ?? '');
  const [base] = useState(item);
  const [error, setError] = useState('');
  return (
    <Card>
      <Txt kind="label">
        {item.name} {item.preparation ? `· ${item.preparation}` : ''}
      </Txt>
      {item.quantity !== null ? (
        <>
          <Field
            label={`Quantidade de ${item.name} (${unitLabels[item.unit]})`}
            value={quantity}
            onChangeText={(value) => {
              setQuantity(value);
              try {
                const parsed = parseOptionalNumber(value) ?? NaN;
                const resized = resizeItem(base, parsed);
                update({
                  ...item,
                  quantity: parsed,
                  nutrients: resized.nutrients,
                  complete: resized.complete,
                });
                setError('');
              } catch {
                update({ ...item, quantity: NaN });
                setError('Informe uma quantidade positiva válida antes de salvar.');
              }
            }}
            keyboardType="decimal-pad"
          />
        </>
      ) : (
        <Field
          label={`Porção aproximada de ${item.name}`}
          value={item.description}
          onChangeText={(description) => update({ ...item, description })}
        />
      )}
      {error ? <Notice error>{error}</Notice> : null}
      <NutritionSummary items={[item]} />
      <Field
        label={`Observação de ${item.name}`}
        value={item.notes}
        onChangeText={(notes) => update({ ...item, notes })}
      />
      <Button secondary title={`Remover ${item.name} deste rascunho`} onPress={remove} />
      <Button secondary title={`Duplicar item ${item.name}`} onPress={duplicate} />
    </Card>
  );
}

const searchKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function ItemBuilder({
  catalog,
  items,
  onChange,
  allowRecipes = true,
}: {
  catalog: Catalog;
  items: MealItem[];
  onChange: (items: MealItem[]) => void;
  allowRecipes?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('todos');
  const [sourceId, setSourceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<Unit>('portion');
  const [portionId, setPortionId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const food = catalog.foods.find((f) => f.id === sourceId);
  const recipe = catalog.recipes.find((r) => r.id === sourceId);
  const foods = catalog.foods.filter(
    (f) =>
      !f.archived &&
      searchKey(f.name).includes(searchKey(query)) &&
      (mode !== 'favoritos' || f.favorite) &&
      (mode !== 'recentes' || catalog.recentFoodIds.includes(f.id)),
  );
  return (
    <>
      <Txt kind="heading">Itens · {items.length}</Txt>
      {items.map((item) => (
        <ItemEditor
          key={item.id}
          item={item}
          update={(updated) => onChange(items.map((i) => (i.id === item.id ? updated : i)))}
          remove={() => onChange(items.filter((i) => i.id !== item.id))}
          duplicate={() => onChange([...items, { ...item, id: randomUUID() }])}
        />
      ))}
      <Card>
        <Txt kind="label">Adicionar alimento ou descrição</Txt>
        <Field
          label="Buscar alimento ou descrever o que comeu"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSourceId('');
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['todos', 'favoritos', 'recentes'].map((m) => (
            <Choice key={m} label={m} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
        {foods.slice(0, 6).map((f) => (
          <Choice
            key={f.id}
            label={`${f.name}${f.preparation ? ` · ${f.preparation}` : ''}`}
            selected={sourceId === f.id}
            onPress={() => {
              setSourceId(f.id);
              setUnit(f.referenceUnit);
              setQuantity(String(f.referenceQuantity));
              setPortionId(null);
            }}
          />
        ))}
        {foods.length > 6 ? (
          <Txt kind="muted">
            {foods.length - 6} outros alimentos. Digite mais para refinar a busca.
          </Txt>
        ) : null}
        {allowRecipes &&
          catalog.recipes
            .filter((r) => !r.archived && searchKey(r.name).includes(searchKey(query)))
            .map((r) => (
              <Choice
                key={r.id}
                label={`Receita · ${r.name}`}
                selected={r.id === sourceId}
                onPress={() => {
                  setSourceId(r.id);
                  setUnit(r.yieldUnit);
                  setQuantity('1');
                  setPortionId(null);
                }}
              />
            ))}
        {food || recipe ? (
          <>
            <Field
              label="Quantidade a adicionar"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(unitLabels) as Unit[]).map((u) => (
                <Choice
                  key={u}
                  label={unitLabels[u]}
                  selected={unit === u && !portionId}
                  onPress={() => {
                    setUnit(u);
                    setPortionId(null);
                  }}
                />
              ))}
            </View>
            {food?.portions.map((p) => (
              <Choice
                key={p.id}
                label={`${p.label} (${p.quantity} ${unitLabels[p.unit]} = ${p.baseQuantity} ${unitLabels[p.baseUnit]})`}
                selected={p.id === portionId}
                onPress={() => {
                  setPortionId(p.id);
                  setUnit(p.unit);
                  setQuantity(String(p.quantity));
                }}
              />
            ))}
            <Txt kind="muted">
              Só calculamos nutrientes com unidades iguais ou uma equivalência explícita deste
              alimento. mL não é convertido em g automaticamente.
            </Txt>
            <Button
              title="Adicionar item"
              onPress={() => {
                try {
                  const q = parseOptionalNumber(quantity);
                  if (q === null) throw new Error();
                  const item = food
                    ? snapshotFood(food, randomUUID(), q, unit, portionId)
                    : snapshotRecipe(recipe!, randomUUID(), q, unit);
                  onChange([...items, item]);
                  setError('');
                  setSourceId('');
                  setQuery('');
                } catch {
                  setError('Confira a quantidade e a unidade do item.');
                }
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="Porção aproximada (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Ex.: um prato, uma fatia"
            />
            <Button
              secondary
              title="Adicionar como descrição, sem pesar"
              onPress={() => {
                try {
                  onChange([...items, descriptiveItem(randomUUID(), query, description)]);
                  setQuery('');
                  setDescription('');
                  setError('');
                } catch {
                  setError('Informe o nome do alimento ou da refeição.');
                }
              }}
            />
          </>
        )}
        {error ? <Notice error>{error}</Notice> : null}
      </Card>
    </>
  );
}
