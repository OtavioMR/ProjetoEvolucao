import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { syntheticSetup } from '../../test/fixtures';
import { SetupScreen } from './setup-screen';

const mockCreateProfile = jest.fn();
const mockReplace = jest.fn();
jest.mock('../../shared/app-provider', () => ({
  useApp: () => ({ createProfile: mockCreateProfile }),
}));
jest.mock('../../domain/profile/defaults', () => ({
  onboardingDefaults: () => jest.requireActual('../../test/fixtures').syntheticSetup(),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');

async function setup() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 780 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <SetupScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateProfile.mockResolvedValue(undefined);
});

it('revisa etapas, permite opcionais vazios e só grava ao confirmar', async () => {
  await setup();
  await fireEvent.changeText(screen.getByLabelText('Como quer ser chamado?'), 'Nome revisado');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Acompanhe do seu jeito.')).toBeTruthy();
  expect(mockCreateProfile).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Pronto para começar.')).toBeTruthy();
  expect(mockCreateProfile).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar perfil e começar' }));
  await waitFor(() => expect(mockCreateProfile).toHaveBeenCalledTimes(1));
  expect(mockCreateProfile.mock.calls[0]?.[0]).toEqual({
    ...syntheticSetup(),
    profile: { ...syntheticSetup().profile, displayName: 'Nome revisado' },
  });
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

it('bloqueia perfil inválido antes de avançar', async () => {
  await setup();
  await fireEvent.changeText(screen.getByLabelText('Como quer ser chamado?'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Informe como prefere ser chamado.')).toBeTruthy();
  expect(mockCreateProfile).not.toHaveBeenCalled();
});

it('falha ao salvar mostra recuperação sem navegar para sucesso', async () => {
  mockCreateProfile.mockRejectedValueOnce(new Error('test_failure'));
  await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Acompanhe do seu jeito.');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Pronto para começar.');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar perfil e começar' }));
  expect(await screen.findByText(/Não foi possível salvar/)).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar perfil e começar' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
});
