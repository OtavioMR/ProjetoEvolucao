import { useState } from 'react';
import { Switch, View } from 'react-native';

import { shiftDate } from '../../src/core/date-time/event-time';
import { isLocalDate, localDateAt } from '../../src/core/date-time/local-date';
import { goalUnits, parseOptionalNumber, type GoalMetric } from '../../src/domain/profile/profile';
import { useApp } from '../../src/shared/app-provider';
import {
  Button,
  Card,
  Field,
  Header,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../src/shared/components/ui';

const labels: Record<GoalMetric, string> = {
  water: 'Água',
  energy: 'Energia',
  protein: 'Proteínas',
  carbs: 'Carboidratos',
  fat: 'Gorduras',
  sleep: 'Sono',
  cardio: 'Cardio',
};

const metrics: GoalMetric[] = ['water', 'energy', 'protein', 'carbs', 'fat', 'sleep', 'cardio'];

export default function GoalsScreen() {
  const { snapshot, upsertGoal } = useApp();
  const [selectedMetric, setSelectedMetric] = useState<GoalMetric>('water');
  const [targetInput, setTargetInput] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!snapshot) return null;
  const today = localDateAt(new Date(), snapshot.profile.timezone);
  const tomorrow = shiftDate(today, 1);
  const visible = snapshot.preferences.visibility;
  const goals = snapshot.goals.filter(
    (g) =>
      g.enabled &&
      g.effectiveFromDate <= today &&
      (!g.effectiveToDate || g.effectiveToDate >= today) &&
      (g.metric !== 'energy' || visible.calories) &&
      (!['protein', 'carbs', 'fat'].includes(g.metric) || visible.macros) &&
      (g.metric !== 'sleep' || visible.sleep),
  );

  const handleSave = async () => {
    if (busy) return;
    const parsed = parseOptionalNumber(targetInput);
    if (parsed === null || Number.isNaN(parsed) || parsed <= 0) {
      setFeedback('Informe um valor alvo positivo.');
      return;
    }
    const fromDate = effectiveDate.trim() || tomorrow;
    if (!isLocalDate(fromDate)) {
      setFeedback('Informe uma data de início válida (AAAA-MM-DD).');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await upsertGoal(selectedMetric, parsed, fromDate, enabled);
      setTargetInput('');
      setFeedback(`Meta de ${labels[selectedMetric]} salva a partir de ${fromDate}.`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Não foi possível atualizar a meta.');
    } finally {
      setBusy(false);
    }
  };

  const metricHistory = snapshot.goals.filter((g) => g.metric === selectedMetric);

  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Referências e metas"
        title="Uma direção flexível."
        description="Alterações futuras preservam o histórico de vigência dos dias anteriores."
      />
      <Notice>
        São estimativas, não orientações médicas individualizadas. Procure avaliação profissional em
        caso de dor persistente, tontura ou outras dificuldades de saúde.
      </Notice>
      <Card>
        <Txt kind="eyebrow">Vigentes hoje ({today})</Txt>
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

      <Card>
        <Txt kind="heading">Nova vigência de meta</Txt>
        <SegmentedControl
          options={metrics.slice(0, 4).map((m) => ({ value: m, label: labels[m] }))}
          value={metrics.slice(0, 4).includes(selectedMetric) ? selectedMetric : 'water'}
          onChange={(v) => setSelectedMetric(v as GoalMetric)}
        />
        <SegmentedControl
          options={metrics.slice(4).map((m) => ({ value: m, label: labels[m] }))}
          value={metrics.slice(4).includes(selectedMetric) ? selectedMetric : 'fat'}
          onChange={(v) => setSelectedMetric(v as GoalMetric)}
        />
        <Field
          label={`Novo alvo de ${labels[selectedMetric]} (${goalUnits[selectedMetric]})`}
          value={targetInput}
          onChangeText={setTargetInput}
          keyboardType="decimal-pad"
          placeholder="Ex.: 2500"
        />
        <Field
          label="Válida a partir de (AAAA-MM-DD)"
          value={effectiveDate}
          onChangeText={setEffectiveDate}
          placeholder={tomorrow}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button secondary title="Hoje" onPress={() => setEffectiveDate(today)} />
          <Button secondary title="Amanhã" onPress={() => setEffectiveDate(tomorrow)} />
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Txt>Meta ativa</Txt>
          <Switch accessibilityLabel="Meta ativa" value={enabled} onValueChange={setEnabled} />
        </View>
        {feedback ? <Notice>{feedback}</Notice> : null}
        <Button title="Salvar vigência" busy={busy} onPress={() => void handleSave()} />
      </Card>

      <Card>
        <Txt kind="eyebrow">Histórico de {labels[selectedMetric]}</Txt>
        {metricHistory.length === 0 ? (
          <Txt kind="muted">Nenhuma versão registrada.</Txt>
        ) : (
          metricHistory.map((g) => (
            <Txt key={g.id} kind="muted">
              {g.effectiveFromDate} até {g.effectiveToDate ?? 'atual'} ·{' '}
              {g.targetValue.toLocaleString('pt-BR')} {g.unit} ({g.enabled ? 'ativa' : 'inativa'})
            </Txt>
          ))
        )}
      </Card>
    </Screen>
  );
}
