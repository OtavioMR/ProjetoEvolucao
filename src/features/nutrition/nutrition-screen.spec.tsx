import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syntheticSetup } from '../../test/fixtures';
import { NutritionScreen } from './nutrition-screen';

const mockPush = jest.fn();
const mockSaveTemplate = jest.fn();
const mockDeleteMeal = jest.fn();
const mockChanged = jest.fn();
const mockSnapshot = {
  ...syntheticSetup(),
  profile: { ...syntheticSetup().profile, id: '20000000-0000-4000-8000-000000000001' },
  goals: [],
};
const sampleMeal = {
  id: '30000000-0000-4000-8000-000000000001',
  localDate: '2026-04-07',
  occurredAt: '2026-04-07T15:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  title: 'Almoço sintético',
  mealType: 'Almoço',
  hunger: null,
  satiety: null,
  context: '' as const,
  notes: '',
  items: [
    {
      id: '30000000-0000-4000-8000-000000000002',
      kind: 'descriptive' as const,
      sourceId: null,
      portionId: null,
      name: 'Prato feito',
      preparation: '',
      description: 'Um prato',
      quantity: null,
      unit: 'portion' as const,
      referenceQuantity: null,
      referenceUnit: null,
      referenceNutrients: {
        kcal: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
      },
      source: '',
      nutrients: {
        kcal: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
      },
      complete: {
        kcal: false,
        protein: false,
        carbs: false,
        fat: false,
        fiber: false,
      },
      notes: '',
    },
  ],
};
const mockContext = {
  snapshot: mockSnapshot,
  selectedDate: '2026-04-07',
  selectDate: jest.fn(),
  recordsChanged: mockChanged,
  diary: { saveTemplate: mockSaveTemplate, deleteMeal: mockDeleteMeal },
  data: {
    meals: [sampleMeal],
    water: [],
    catalog: { foods: [], recipes: [], templates: [], recentFoodIds: [] },
  },
  error: false,
  retry: jest.fn(),
};
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('../diary/use-diary', () => ({
  ...jest.requireActual('../diary/use-diary'),
  useDiary: () => mockContext,
}));
jest.mock('../../shared/app-provider', () => ({ useApp: () => mockContext }));

async function setup() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 780 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <NutritionScreen />
    </SafeAreaProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSaveTemplate.mockResolvedValue(undefined);
  mockDeleteMeal.mockResolvedValue(undefined);
});
it('alterna entre Diário e Biblioteca pelo SegmentedControl', async () => {
  await setup();
  expect(screen.getByText('Almoço sintético')).toBeTruthy();
  expect(screen.queryByText('Catálogo de alimentos')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Biblioteca' }));
  expect(screen.getByText('Catálogo de alimentos')).toBeTruthy();
  expect(screen.getByText('Receitas caseiras')).toBeTruthy();
  expect(screen.getByText('Modelos de refeição')).toBeTruthy();
  expect(screen.queryByText('Almoço sintético')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Diário' }));
  expect(screen.getByText('Almoço sintético')).toBeTruthy();
});
it('abre o menu de ações da refeição e permite salvar como modelo ou editar', async () => {
  await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Mais ações para Almoço sintético' }));
  expect(screen.getByRole('button', { name: 'Editar refeição' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar como modelo' }));
  await waitFor(() => expect(mockSaveTemplate).toHaveBeenCalledTimes(1));
  expect(mockSaveTemplate.mock.calls[0][1]).toMatchObject({
    name: 'Almoço sintético',
  });

  await fireEvent.press(screen.getByRole('button', { name: 'Mais ações para Almoço sintético' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Editar refeição' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/nutrition/meal',
    params: { id: sampleMeal.id },
  });
});
