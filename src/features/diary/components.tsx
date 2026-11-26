import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { isLocalDate, localDateAt } from '../../core/date-time/local-date';
import { shiftDate } from '../../core/date-time/event-time';
import { summarize, type MealItem, type Nutrient } from '../../domain/nutrition/nutrition';
import { useApp } from '../../shared/app-provider';
import { Button, Card, Field, IconButton, Notice, Txt } from '../../shared/components/ui';

export const numberText = (n: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n);
export function DateSelector() {
  const { selectedDate, selectDate, snapshot } = useApp();
  const [draft, setDraft] = useState(selectedDate);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const today = localDateAt(new Date(), snapshot!.profile.timezone);
  const isToday = selectedDate === today;
  const choose = (date: string) => {
    selectDate(date);
    setDraft(date);
    setError(false);
    setExpanded(false);
  };
  return (
    <Card style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton
          icon="chevron-back"
          label="Dia anterior"
          onPress={() => choose(shiftDate(selectedDate, -1))}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selecionar outra data"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 }}
        >
          <Txt kind="label" style={{ textAlign: 'center' }}>
            {selectedDate.split('-').reverse().join('/')}
          </Txt>
          <Txt kind="muted" style={{ textAlign: 'center' }}>
            {isToday ? 'Hoje · toque para trocar' : 'Toque para trocar data'}
          </Txt>
        </Pressable>
        <IconButton
          icon="chevron-forward"
          label="Dia seguinte"
          onPress={() => choose(shiftDate(selectedDate, 1))}
        />
      </View>
      {!isToday ? (
        <Button compact secondary title="Voltar para hoje" onPress={() => choose(today)} />
      ) : null}
      {expanded ? (
        <>
          <Field
            label="Outra data (AAAA-MM-DD)"
            value={draft}
            onChangeText={setDraft}
            placeholder="AAAA-MM-DD"
            error={error ? 'Informe uma data válida.' : undefined}
          />
          <Button
            secondary
            title="Consultar data"
            onPress={() => (isLocalDate(draft) ? choose(draft) : setError(true))}
          />
        </>
      ) : null}
    </Card>
  );
}

export function NutritionSummary({ items }: { items: MealItem[] }) {
  const { snapshot } = useApp();
  const visibility = snapshot!.preferences.visibility;
  const summary = summarize(items);
  const keys: Nutrient[] = [
    ...(visibility.calories ? ['kcal' as const] : []),
    ...(visibility.macros ? ['protein' as const, 'carbs' as const, 'fat' as const] : []),
  ];
  const labels = {
    kcal: 'Energia',
    protein: 'Proteínas',
    carbs: 'Carboidratos',
    fat: 'Gorduras',
    fiber: 'Fibras',
  };
  if (!keys.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {keys.map((key) => (
        <Txt key={key}>
          {labels[key]}:{' '}
          {summary.nutrients[key] === null
            ? 'Não informado'
            : `${numberText(summary.nutrients[key])} ${key === 'kcal' ? 'kcal' : 'g'}${summary.complete[key] ? '' : ' · total conhecido parcial'}`}
        </Txt>
      ))}
      {items.length > 0 && keys.some((key) => !summary.complete[key]) && (
        <Txt kind="muted">
          Há dados nutricionais incompletos. O total conhecido não representa toda a ingestão do
          dia.
        </Txt>
      )}
    </View>
  );
}

export function LoadState({ error, retry }: { error: boolean; retry: () => void }) {
  return error ? (
    <>
      <Notice error>Não foi possível ler os registros locais.</Notice>
      <Button title="Tentar novamente" onPress={retry} />
    </>
  ) : (
    <Txt kind="muted">Carregando registros…</Txt>
  );
}
