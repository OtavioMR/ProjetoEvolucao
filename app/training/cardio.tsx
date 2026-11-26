import { Stack } from 'expo-router';
import { CardioScreen } from '../../src/features/training/cardio-screen';

export default function TrainingCardioRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Cardio' }} />
      <CardioScreen />
    </>
  );
}
