import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Card, Header, Screen, Txt } from '../../shared/components/ui';
import { useTheme } from '../../shared/theme/theme';
import { DateSelector, LoadState, NutritionSummary, numberText } from '../diary/components';
import { useDiary } from '../diary/use-diary';
import { WaterQuickActions } from '../hydration/hydration-screen';
import { calculateSessionVolume, summarizeCardioDay } from '../../domain/training/training';
import {
  dailyWeightSeries,
  formatMinutesAsHours,
  summarizeSleepDay,
} from '../../domain/evolution/evolution';
import { useEvolution } from '../progress/use-evolution';
import { useTraining } from '../training/use-training';

function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 8,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Txt kind="label" style={{ color: colors.accent }}>
        {label}
      </Txt>
      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
    </Pressable>
  );
}

export function TodayScreen() {
  const { snapshot, data, selectedDate, error, retry } = useDiary();
  const trainingState = useTraining();
  const evolutionState = useEvolution();
  const router = useRouter();
  const visible = snapshot?.preferences.visibility;
  const water = data?.water.filter((w) => w.beverage === 'water') ?? [];
  const completedSessions =
    trainingState.data?.daySessions.filter((s) => s.status === 'completed') ?? [];
  const cardioSummary = trainingState.data
    ? summarizeCardioDay(trainingState.data.dayCardio)
    : null;
  const dailyWeights = evolutionState.data ? dailyWeightSeries(evolutionState.data.weights) : [];
  const latestWeight = dailyWeights[dailyWeights.length - 1] ?? null;
  const sleepSummary = evolutionState.data ? summarizeSleepDay(evolutionState.data.daySleep) : null;
  return (
    <Screen>
      <Header
        eyebrow="Evolução / Hoje"
        title={`Olá, ${snapshot!.profile.displayName}.`}
        description="Consulte e registre sua rotina no dia escolhido."
      />
      <DateSelector key={selectedDate} />
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Txt kind="eyebrow">Alimentação</Txt>
              <SectionLink label="Ver diário" onPress={() => router.push('/(tabs)/nutrition')} />
            </View>
            <Txt kind="heading">
              {data.meals.length
                ? `${data.meals.length} refeição(ões) registrada(s)`
                : 'Não registrado'}
            </Txt>
            <NutritionSummary items={data.meals.flatMap((m) => m.items)} />
            <Button
              title="Registrar refeição"
              icon="add-outline"
              onPress={() => router.push('/nutrition/meal')}
            />
          </Card>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Txt kind="eyebrow">Água</Txt>
              <SectionLink label="Detalhes" onPress={() => router.push('/hydration')} />
            </View>
            <Txt kind="heading">
              {water.length
                ? `${numberText(water.reduce((sum, w) => sum + w.amountMl, 0))} mL`
                : 'Não registrado'}
            </Txt>
            <WaterQuickActions />
          </Card>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Txt kind="eyebrow">Treinos e cardio</Txt>
              <SectionLink label="Ver treinos" onPress={() => router.push('/(tabs)/training')} />
            </View>
            <Txt kind="heading">
              {trainingState.data?.activeSession
                ? `Em andamento: ${trainingState.data.activeSession.title}`
                : completedSessions.length
                  ? `${completedSessions.length} treino(s) concluído(s)`
                  : 'Não registrado'}
            </Txt>
            {completedSessions.length ? (
              <Txt kind="muted">
                Volume:{' '}
                {numberText(
                  completedSessions.reduce(
                    (sum, s) => sum + calculateSessionVolume(s.exercises).volumeKgReps,
                    0,
                  ),
                )}{' '}
                kg·reps
              </Txt>
            ) : null}
            <Txt kind="muted">
              Cardio:{' '}
              {cardioSummary && cardioSummary.count > 0
                ? `${cardioSummary.totalMinutes} min`
                : 'Não registrado'}
            </Txt>
          </Card>
          {visible?.weight ? (
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Txt kind="eyebrow">Peso</Txt>
                <SectionLink label="Registrar" onPress={() => router.push('/progress/weight')} />
              </View>
              <Txt kind="heading">
                {latestWeight ? `${numberText(latestWeight.value)} kg` : 'Não registrado'}
              </Txt>
              {latestWeight ? (
                <Txt kind="muted">Última pesagem em {latestWeight.localDate}</Txt>
              ) : null}
            </Card>
          ) : null}
          {visible?.sleep ? (
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Txt kind="eyebrow">Sono</Txt>
                <SectionLink label="Detalhes" onPress={() => router.push('/progress/sleep')} />
              </View>
              <Txt kind="heading">
                {sleepSummary && sleepSummary.totalMinutes > 0
                  ? formatMinutesAsHours(sleepSummary.totalMinutes)
                  : 'Não registrado'}
              </Txt>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
