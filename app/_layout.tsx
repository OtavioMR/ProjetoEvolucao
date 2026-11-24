import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '../src/shared/app-provider';
import { Button, Header, Notice, Screen } from '../src/shared/components/ui';
import { ThemeProvider, useTheme } from '../src/shared/theme/theme';

function Navigation() {
  const { status, snapshot, retry } = useApp();
  const { colors, isDark } = useTheme();
  if (status !== 'ready')
    return (
      <Screen>
        <Header
          eyebrow="Evolução"
          title={status === 'error' ? 'Seus dados precisam de atenção.' : 'Abrindo seu espaço.'}
          description={
            status === 'error'
              ? 'Não foi possível abrir o banco local. Nenhum dado foi apagado. Se houve atualização, confira a versão do aplicativo.'
              : 'Preparando o armazenamento neste dispositivo.'
          }
        />
        {status === 'loading' ? (
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Inicializando banco de dados"
          />
        ) : (
          <Button title="Tentar novamente" onPress={retry} />
        )}
      </Screen>
    );
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Protected guard={!snapshot}>
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!snapshot}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings/profile" options={{ title: 'Perfil' }} />
          <Stack.Screen name="settings/preferences" options={{ title: 'Preferências' }} />
          <Stack.Screen name="settings/privacy" options={{ title: 'Privacidade' }} />
          <Stack.Screen name="settings/goals" options={{ title: 'Referências' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider>
          <Navigation />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <SafeAreaProvider>
      <Screen>
        <Header
          eyebrow="Evolução"
          title="Não foi possível abrir esta tela."
          description="Tente recarregar. Seus registros permanecem no armazenamento local."
        />
        <Notice>Se o erro persistir, reinicie o aplicativo sem limpar seus dados.</Notice>
        <Button title="Tentar novamente" onPress={retry} />
      </Screen>
    </SafeAreaProvider>
  );
}
