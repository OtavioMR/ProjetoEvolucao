import { Stack } from 'expo-router';
import { HistoryScreen } from '../../src/features/training/history-screen';

export default function TrainingHistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Histórico de treinos' }} />
      <HistoryScreen />
    </>
  );
}
