import { useRouter } from 'expo-router';
import { Button, Header, Screen } from '../src/shared/components/ui';
export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Header
        eyebrow="Evolução"
        title="Página não encontrada."
        description="Volte ao seu espaço para continuar."
      />
      <Button title="Voltar ao início" onPress={() => router.replace('/')} />
    </Screen>
  );
}
