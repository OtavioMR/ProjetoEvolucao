import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syntheticSetup } from '../../test/fixtures';
import { MealEditorScreen } from './meal-editor-screen';

const mockSaveMeal = jest.fn();
const mockBack = jest.fn();
const mockChanged = jest.fn();
const mockSnapshot = {
  ...syntheticSetup(),
  profile: { ...syntheticSetup().profile, id: '20000000-0000-4000-8000-000000000001' },
  goals: [],
};
const mockContext = {
  snapshot: mockSnapshot,
  selectedDate: '2026-04-07',
  recordsChanged: mockChanged,
  diary: { saveMeal: mockSaveMeal },
  data: {
    meals: [],
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
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({}),
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
      <MealEditorScreen />
    </SafeAreaProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSaveMeal.mockResolvedValue(undefined);
});
it('registra descrição sem calorias na data escolhida e aguarda a gravação para navegar', async () => {
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('Buscar alimento ou descrever o que comeu'),
    'Refeição sintética',
  );
  await fireEvent.changeText(screen.getByLabelText('Porção aproximada (opcional)'), 'Um prato');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Adicionar como descrição, sem pesar' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Data e horário' }));
  await fireEvent.changeText(screen.getByLabelText('Horário da refeição (HH:mm)'), '23:50');
  expect(screen.queryByText(/kcal/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar refeição' }));
  await waitFor(() => expect(mockSaveMeal).toHaveBeenCalledTimes(1));
  expect(mockSaveMeal.mock.calls[0][1]).toMatchObject({
    localDate: '2026-04-07',
    occurredAt: '2026-04-08T02:50:00.000Z',
    items: [
      {
        name: 'Refeição sintética',
        quantity: null,
        description: 'Um prato',
        nutrients: { kcal: null },
      },
    ],
  });
  expect(mockBack).toHaveBeenCalledTimes(1);
});
it('recusa refeição vazia sem criar registro', async () => {
  await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar refeição' }));
  expect(mockSaveMeal).not.toHaveBeenCalled();
  expect(await screen.findByText(/Revise título/)).toBeTruthy();
});
it('erro de gravação mantém formulário e mostra recuperação', async () => {
  mockSaveMeal.mockRejectedValueOnce(new Error('disk_full'));
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('Buscar alimento ou descrever o que comeu'),
    'Teste',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Adicionar como descrição, sem pesar' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar refeição' }));
  expect(await screen.findByText(/Não foi possível concluir/)).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});
