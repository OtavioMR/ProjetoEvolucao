import { Stack } from 'expo-router';
import { SessionScreen } from '../../src/features/training/session-screen';

export default function TrainingSessionRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sessão de treino' }} />
      <SessionScreen />
    </>
  );
}
