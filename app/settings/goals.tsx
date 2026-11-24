import { localDateAt } from '../../src/core/date-time/local-date';
import type { GoalMetric } from '../../src/domain/profile/profile';
import { useApp } from '../../src/shared/app-provider';
import { Card, Header, Notice, Screen, Txt } from '../../src/shared/components/ui';

const labels: Record<GoalMetric, string> = {
  water: 'Água',
  energy: 'Energia',
  protein: 'Proteínas',
  carbs: 'Carboidratos',
  fat: 'Gorduras',
  sleep: 'Sono',
  cardio: 'Cardio',
};
export default function GoalsScreen() {
  const { snapshot } = useApp();
  const today = localDateAt(new Date(), snapshot!.profile.timezone);
  const visible = snapshot!.preferences.visibility;
  const goals = snapshot!.goals.filter(
    (g) =>
      g.enabled &&
      g.effectiveFromDate <= today &&
      (!g.effectiveToDate || g.effectiveToDate >= today) &&
      (g.metric !== 'energy' || visible.calories) &&
      (!['protein', 'carbs', 'fat'].includes(g.metric) || visible.macros) &&
      (g.metric !== 'sleep' || visible.sleep),
  );
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Referências iniciais"
        title="Uma direção flexível."
        description="Valores revisados no onboarding, sem regras automáticas ou compensações."
      />
      <Notice>
        São estimativas, não orientações médicas individualizadas. Procure avaliação profissional em
        caso de dor persistente, tontura ou outras dificuldades de saúde.
      </Notice>
      <Card>
        {goals.length === 0 ? (
          <Txt kind="muted">Nenhuma referência visível configurada.</Txt>
        ) : (
          goals.map((goal) => (
            <Txt key={goal.id}>
              {labels[goal.metric]} · {goal.targetValue.toLocaleString('pt-BR')}{' '}
              {goal.unit === 'hours'
                ? 'h/noite'
                : goal.unit === 'minutes'
                  ? 'min/semana'
                  : `${goal.unit}/dia`}
            </Txt>
          ))
        )}
      </Card>
      <Txt kind="muted">
        Calorias, macros e sono seguem as preferências de visibilidade. A edição de metas com nova
        vigência será entregue na Fase 3.
      </Txt>
    </Screen>
  );
}
