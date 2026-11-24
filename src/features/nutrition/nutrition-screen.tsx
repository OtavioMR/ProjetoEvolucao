import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { localTimeAt } from '../../core/date-time/event-time';
import { unitLabels } from '../../domain/nutrition/nutrition';
import { Button, Card, Header, NavRow, Notice, Screen, Txt } from '../../shared/components/ui';
import { DateSelector, LoadState, NutritionSummary, numberText } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';

export function NutritionScreen() {
  const { data, diary, snapshot, selectedDate, recordsChanged, error, retry } = useDiary();
  const router = useRouter();
  const action = useAction();
  return (
    <Screen>
      <Header
        eyebrow="Evolução / Alimentação"
        title="Seu diário alimentar."
        description="Registros do dia escolhido. Calorias e macros são opcionais."
      />
      <DateSelector key={selectedDate} />
      <Button
        title="Registrar refeição"
        icon="add-outline"
        onPress={() => router.push('/nutrition/meal')}
      />
      <NavRow
        title="Catálogo de alimentos"
        detail="Cadastro local, fontes, equivalências e favoritos"
        href="/nutrition/catalog"
        icon="search-outline"
      />
      <NavRow
        title="Receitas caseiras"
        detail="Ingredientes e rendimento final informado"
        href="/nutrition/recipes"
        icon="restaurant-outline"
      />
      <NavRow
        title="Modelos de refeição"
        detail="Combinações editáveis para usar ao registrar"
        href="/nutrition/templates"
        icon="copy-outline"
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      {!data ? (
        <LoadState error={error} retry={retry} />
      ) : (
        <>
          <Card>
            <Txt kind="heading">
              {data.meals.length
                ? `${data.meals.length} refeição(ões) registrada(s)`
                : 'Nenhuma refeição registrada'}
            </Txt>
            <NutritionSummary items={data.meals.flatMap((m) => m.items)} />
          </Card>
          {data.meals.map((meal) => (
            <Card key={meal.id}>
              <Txt kind="heading">{meal.title}</Txt>
              <Txt kind="muted">
                {meal.mealType} · {localTimeAt(new Date(meal.occurredAt), meal.timezone)} ·{' '}
                {meal.timezone}
              </Txt>
              {meal.items.map((i) => (
                <Txt key={i.id}>
                  {i.name} ·{' '}
                  {i.quantity === null
                    ? i.description || 'Porção não informada'
                    : `${numberText(i.quantity)} ${unitLabels[i.unit]}`}
                </Txt>
              ))}
              <NutritionSummary items={meal.items} />
              {meal.notes ? <Txt kind="muted">{meal.notes}</Txt> : null}
              <Button
                secondary
                title={`Editar ${meal.title}`}
                onPress={() =>
                  router.push({ pathname: '/nutrition/meal', params: { id: meal.id } })
                }
              />
              <Button
                secondary
                title={`Repetir ou copiar ${meal.title}`}
                onPress={() =>
                  router.push({ pathname: '/nutrition/meal', params: { id: meal.id, copy: '1' } })
                }
              />
              <Button
                secondary
                title={`Salvar ${meal.title} como modelo`}
                busy={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await diary!.saveTemplate(snapshot!.profile.id, {
                      id: randomUUID(),
                      name: meal.title,
                      items: meal.items.map((i) => ({ ...i, id: randomUUID() })),
                    });
                    recordsChanged();
                  }, 'Modelo salvo. Nenhum consumo adicional foi registrado.')
                }
              />
              <Button
                secondary
                title={`Excluir ${meal.title}`}
                busy={action.busy}
                onPress={() =>
                  Alert.alert(
                    'Excluir refeição?',
                    'A refeição e seus itens serão removidos deste dia.',
                    [
                      { text: 'Manter', style: 'cancel' },
                      {
                        text: 'Excluir refeição',
                        style: 'destructive',
                        onPress: () =>
                          void action.run(async () => {
                            await diary!.deleteMeal(snapshot!.profile.id, meal.id);
                            recordsChanged();
                          }, 'Refeição excluída.'),
                      },
                    ],
                  )
                }
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
