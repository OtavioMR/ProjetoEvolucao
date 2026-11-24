import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syntheticBackup } from '../../test/backup-fixture';
import { BackupScreen } from './backup-screen';

const mockRestore = jest.fn();
const mockExport = jest.fn();
const mockReload = jest.fn();
const mockPicker = jest.fn();
const mockShare = jest.fn();
const mockWrite = jest.fn();
let mockText = '';
jest.mock('expo-document-picker', () => ({ getDocumentAsync: () => mockPicker() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '30000000-0000-4000-8000-000000000002' }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    uri = 'file:///cache/backup.json';
    size = 123;
    create() {}
    write(value: string) {
      mockWrite(value);
    }
    text() {
      return Promise.resolve(mockText);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => Promise.resolve(true),
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('../../shared/app-provider', () => ({
  useApp: () => ({
    backup: { restore: mockRestore, export: mockExport },
    reloadProfile: mockReload,
  }),
}));
async function setup() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 780 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <BackupScreen />
    </SafeAreaProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockText = JSON.stringify(syntheticBackup());
  mockExport.mockResolvedValue(syntheticBackup());
  mockRestore.mockResolvedValue(undefined);
  mockReload.mockResolvedValue(undefined);
  mockPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/fixture.json', size: 123 }],
  });
});
it('selecionar e visualizar não restaura; substituição exige confirmação digitada', async () => {
  await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Selecionar backup para prévia' }));
  expect(await screen.findByText('Prévia da restauração')).toBeTruthy();
  expect(mockRestore).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Continuar sem exportar dados atuais' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Restaurar e substituir dados locais' }),
  );
  expect(mockRestore).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Digite SUBSTITUIR para confirmar'),
    'SUBSTITUIR',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Restaurar e substituir dados locais' }),
  );
  await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1));
  expect(mockReload).toHaveBeenCalledTimes(1);
});
it('arquivo inválido é recusado sem chamar o repositório de restauração', async () => {
  mockText = '{inválido';
  await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Selecionar backup para prévia' }));
  expect(await screen.findByText(/Arquivo inválido/)).toBeTruthy();
  expect(mockRestore).not.toHaveBeenCalled();
});
it('exporta arquivo somente após ação e abre compartilhamento explicitamente', async () => {
  await setup();
  expect(mockShare).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Exportar backup JSON' }));
  await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
  expect(JSON.parse(mockWrite.mock.calls[0][0])).toMatchObject({
    schemaVersion: 2,
    formatVersion: 1,
  });
});
