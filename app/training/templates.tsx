import { Stack } from 'expo-router';
import { TemplatesScreen } from '../../src/features/training/templates-screen';

export default function TrainingTemplatesRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Fichas de treino' }} />
      <TemplatesScreen />
    </>
  );
}
