import { PhaseScreen } from '../../src/features/dashboard/phase-screen';
export default function TrainingScreen() {
  return (
    <PhaseScreen
      phase={2}
      title="Treinos"
      description="Acompanhar cada série e retomar de onde parou."
      items={[
        'Biblioteca, fichas editáveis e agenda pessoal.',
        'Sessão com séries, cargas, repetições e descanso.',
        'Recuperação do treino depois de fechar o aplicativo.',
        'Histórico comparável e cardio sem contagem duplicada.',
      ]}
    />
  );
}
