import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PrivacyScreen from '../../../app/settings/privacy';
import { RemindersScreen } from './reminders-screen';

const mockRequestPermission = jest.fn();
const mockSyncReminders = jest.fn();
const mockListReminders = jest.fn();
const mockUpsertReminder = jest.fn();
const mockEraseAll = jest.fn();

jest.mock('../../core/notifications/reminder-scheduler', () => ({
  requestReminderPermission: () => mockRequestPermission(),
  syncScheduledReminders: (...args: unknown[]) => mockSyncReminders(...args),
  cancelAllScheduledReminders: () => Promise.resolve(),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
const mockApp = {
  snapshot: {
    profile: {
      id: '30000000-0000-4000-8000-000000000001',
      timezone: 'America/Sao_Paulo',
    },
  },
  reminders: {
    list: mockListReminders,
    upsert: mockUpsertReminder,
  },
  eraseAllLocalData: mockEraseAll,
};
jest.mock('../../shared/app-provider', () => ({
  useApp: () => mockApp,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 780 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListReminders.mockResolvedValue([]);
  mockUpsertReminder.mockResolvedValue({});
  mockSyncReminders.mockResolvedValue({ permissionGranted: true, scheduledCount: 0 });
  mockEraseAll.mockResolvedValue(undefined);
});

describe('Fase 4 screens', () => {
  it('mantém lembretes desativados e não trava quando permissão é recusada', async () => {
    mockRequestPermission.mockResolvedValue(false);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <RemindersScreen />
      </SafeAreaProvider>,
    );
    const toggle = await screen.findByRole('switch', { name: 'Hidratação' });
    await fireEvent(toggle, 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar lembretes' }));
    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalled());
    expect(
      await screen.findByText(/Permissão de notificações não concedida neste dispositivo/i),
    ).toBeTruthy();
  });

  it('exige confirmação APAGAR TUDO antes de executar exclusão total', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PrivacyScreen />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar todos os dados locais' }));
    expect(mockEraseAll).not.toHaveBeenCalled();
    expect(await screen.findByText(/Digite APAGAR TUDO exatamente para confirmar/i)).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('Digite APAGAR TUDO para confirmar'),
      'APAGAR TUDO',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar todos os dados locais' }));
    await waitFor(() => expect(mockEraseAll).toHaveBeenCalledTimes(1));
  });
});
