import { PhaseScreen } from '../../src/features/dashboard/phase-screen';
export default function NutritionScreen() {
  return (
    <PhaseScreen
      phase={1}
      title="Alimentação"
      description="Um registro flexível para a comida da sua rotina."
      items={[
        'Catálogo local, porções e receitas com fontes identificadas.',
        'Diário por refeição, sem obrigação de contar calorias.',
        'Modelos, cópias e histórico nutricional preservado.',
        'Dados desconhecidos sinalizados e backup dos registros.',
      ]}
    />
  );
}
