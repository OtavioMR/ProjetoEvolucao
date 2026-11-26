import { Stack } from 'expo-router';
import { LibraryScreen } from '../../src/features/training/library-screen';

export default function TrainingLibraryRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Biblioteca de exercícios' }} />
      <LibraryScreen />
    </>
  );
}
