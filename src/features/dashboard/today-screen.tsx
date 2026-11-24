import { useRouter } from 'expo-router';
import { Button, Card, Header, NavRow, Notice, Screen, Txt } from '../../shared/components/ui';
import { DateSelector, LoadState, NutritionSummary, numberText } from '../diary/components';
import { useDiary } from '../diary/use-diary';
import { WaterQuickActions } from '../hydration/hydration-screen';

export function TodayScreen() {
  const { snapshot, data, selectedDate, error, retry } = useDiary();
  const router = useRouter();
  const water = data?.water.filter((w) => w.beverage === 'water') ?? [];
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
            <Txt kind="eyebrow">Alimentação</Txt>
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
            <NavRow
              title="Consultar diário deste dia"
              detail="Refeições, porções e observações"
              href="/(tabs)/nutrition"
              icon="restaurant-outline"
            />
          </Card>
          <Card>
            <Txt kind="eyebrow">Água</Txt>
            <Txt kind="heading">
              {water.length
                ? `${numberText(water.reduce((sum, w) => sum + w.amountMl, 0))} mL`
                : 'Não registrado'}
            </Txt>
            <WaterQuickActions />
            <NavRow
              title="Consultar água deste dia"
              detail="Editar volume, horário e outras bebidas"
              href="/hydration"
              icon="water-outline"
            />
          </Card>
        </>
      )}
      <NavRow
        title="Backup dos seus dados"
        detail="Exportar ou restaurar um arquivo local"
        href="/settings/backup"
        icon="download-outline"
      />
      <Notice>Treinos e cardio serão entregues na Fase 2. Peso, sono e evolução, na Fase 3.</Notice>
    </Screen>
  );
}
