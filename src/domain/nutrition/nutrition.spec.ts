import { eventInstant } from '../../core/date-time/event-time';
import {
  foodSchema,
  snapshotFood,
  snapshotRecipe,
  summarize,
  unknownNutrients,
  type Food,
  type Recipe,
} from './nutrition';

const food = (): Food => ({
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Alimento de teste',
  preparation: '',
  brand: '',
  referenceQuantity: 100,
  referenceUnit: 'g',
  nutrients: { ...unknownNutrients(), kcal: 130, fat: 0 },
  source: 'Rótulo sintético',
  sourceVersion: '',
  portions: [],
  favorite: false,
  archived: false,
});
const itemId = '20000000-0000-4000-8000-000000000002';

it('calcula 195 kcal e preserva zero declarado e nutrientes desconhecidos', () => {
  const item = snapshotFood(food(), itemId, 150, 'g');
  expect(item.nutrients.kcal).toBe(195);
  expect(item.nutrients.fat).toBe(0);
  expect(item.nutrients.protein).toBeNull();
});
it('não converte mL em g sem equivalência explícita do alimento', () => {
  const f = food();
  expect(snapshotFood(f, itemId, 150, 'mL').nutrients.kcal).toBeNull();
  f.portions = [
    {
      id: itemId,
      label: 'Densidade confirmada',
      unit: 'mL',
      quantity: 100,
      baseQuantity: 80,
      baseUnit: 'g',
    },
  ];
  expect(snapshotFood(f, itemId, 100, 'mL', itemId).nutrients.kcal).toBe(104);
});
it('exige fonte ao preencher nutrientes e rejeita números não finitos', () => {
  expect(foodSchema.safeParse({ ...food(), source: '' }).success).toBe(false);
  expect(() => snapshotFood(food(), itemId, Infinity, 'g')).toThrow();
  expect(() => snapshotFood(food(), itemId, -1, 'g')).toThrow();
});
it('receita divide pelos gramas finais ou pelo número de porções informado', () => {
  const recipe: Recipe = {
    id: itemId,
    name: 'Receita teste',
    yieldQuantity: 500,
    yieldUnit: 'g',
    items: [snapshotFood(food(), itemId, 200, 'g')],
    notes: '',
    archived: false,
  };
  expect(snapshotRecipe(recipe, itemId, 250, 'g').nutrients.kcal).toBe(130);
  expect(
    snapshotRecipe({ ...recipe, yieldQuantity: 4, yieldUnit: 'portion' }, itemId, 1, 'portion')
      .nutrients.kcal,
  ).toBe(65);
  expect(snapshotRecipe(recipe, itemId, 1, 'portion').nutrients.kcal).toBeNull();
});
it('ausência de registros não é zero e totais parciais mantêm cobertura', () => {
  expect(summarize([]).nutrients.kcal).toBeNull();
  const known = snapshotFood(food(), itemId, 100, 'g');
  const unknown = snapshotFood({ ...food(), nutrients: unknownNutrients() }, itemId, 100, 'g');
  expect(summarize([known, unknown])).toMatchObject({
    nutrients: { kcal: 130 },
    complete: { kcal: false },
  });
});
it('data retroativa usa fuso, inclusive 23h50, e rejeita horário inexistente ou ambíguo', () => {
  expect(eventInstant('2026-04-07', '23:50', 'America/Sao_Paulo')).toBe('2026-04-08T02:50:00.000Z');
  expect(() => eventInstant('2026-03-08', '02:30', 'America/New_York')).toThrow();
  expect(() => eventInstant('2026-11-01', '01:30', 'America/New_York')).toThrow();
  expect(eventInstant('2026-11-01', '01:30', 'America/New_York', '2026-11-01T05:30:00.000Z')).toBe(
    '2026-11-01T05:30:00.000Z',
  );
});
