import { Stack } from 'expo-router';
import { PlanScreen } from '../../src/features/training/plan-screen';

export default function TrainingPlanRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Agenda de treinos' }} />
      <PlanScreen />
    </>
  );
}
