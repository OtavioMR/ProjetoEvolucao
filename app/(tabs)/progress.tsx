import { PhaseScreen } from '../../src/features/dashboard/phase-screen';
export default function ProgressScreen() {
  return (
    <PhaseScreen
      phase={3}
      title="Evolução"
      description="Observar tendências a partir do que você registrar."
      items={[
        'Peso e medidas opcionais, gráficos e cobertura dos dados.',
        'Sono, hábitos e calendário de registros.',
        'Metas com histórico de vigência preservado.',
        'Revisão semanal e resumo com campos selecionáveis.',
      ]}
    />
  );
}
