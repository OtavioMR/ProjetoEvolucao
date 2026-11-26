import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { localTimeAt } from '../../core/date-time/event-time';
import { unitLabels, type Meal } from '../../domain/nutrition/nutrition';
import {
  ActionSheetModal,
  Button,
  Card,
  Header,
  IconButton,
  NavRow,
  Notice,
  Screen,
  SegmentedControl,
  Txt,
} from '../../shared/components/ui';
import { DateSelector, LoadState, NutritionSummary, numberText } from '../diary/components';
import { useAction, useDiary } from '../diary/use-diary';

export function NutritionScreen() {
  const { data, diary, snapshot, selectedDate, recordsChanged, error, retry } = useDiary();
  const router = useRouter();
  const action = useAction();
  const [section, setSection] = useState<'diary' | 'library'>('diary');
  const [menuMeal, setMenuMeal] = useState<Meal | null>(null);
  return (
    <Screen>
      <Header
        eyebrow="Evolução / Alimentação"
        title="Sua alimentação."
        description="Diário do dia e biblioteca local. Calorias e macros são opcionais."
      />
      <SegmentedControl
        value={section}
        onChange={setSection}
        options={[
          { value: 'diary', label: 'Diário' },
          { value: 'library', label: 'Biblioteca' },
        ]}
      />
      {section === 'library' ? (
        <>
          <Notice>
            Alterar alimentos, receitas ou modelos aqui não muda as refeições já registradas.
          </Notice>
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
        </>
      ) : (
        <>
          <DateSelector key={selectedDate} />
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
                <Button
                  title="Registrar refeição"
                  icon="add-outline"
                  onPress={() => router.push('/nutrition/meal')}
                />
              </Card>
              {data.meals.map((meal) => (
                <Card key={meal.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${meal.title}`}
                      onPress={() =>
                        router.push({ pathname: '/nutrition/meal', params: { id: meal.id } })
                      }
                      style={{ flex: 1, minHeight: 48, justifyContent: 'center', gap: 2 }}
                    >
                      <Txt kind="heading">{meal.title}</Txt>
                      <Txt kind="muted">
                        {meal.mealType} · {localTimeAt(new Date(meal.occurredAt), meal.timezone)}
                      </Txt>
                    </Pressable>
                    <IconButton
                      icon="ellipsis-horizontal"
                      label={`Mais ações para ${meal.title}`}
                      busy={action.busy}
                      onPress={() => setMenuMeal(meal)}
                    />
                  </View>
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
                </Card>
              ))}
            </>
          )}
        </>
      )}
      <ActionSheetModal
        visible={!!menuMeal}
        title={menuMeal?.title ?? ''}
        subtitle={
          menuMeal
            ? `${menuMeal.mealType} · ${localTimeAt(new Date(menuMeal.occurredAt), menuMeal.timezone)}`
            : undefined
        }
        onClose={() => setMenuMeal(null)}
        actions={
          menuMeal
            ? [
                {
                  label: 'Editar refeição',
                  icon: 'create-outline',
                  onPress: () =>
                    router.push({ pathname: '/nutrition/meal', params: { id: menuMeal.id } }),
                },
                {
                  label: 'Repetir ou copiar',
                  icon: 'copy-outline',
                  onPress: () =>
                    router.push({
                      pathname: '/nutrition/meal',
                      params: { id: menuMeal.id, copy: '1' },
                    }),
                },
                {
                  label: 'Salvar como modelo',
                  icon: 'bookmark-outline',
                  onPress: () =>
                    void action.run(async () => {
                      await diary!.saveTemplate(snapshot!.profile.id, {
                        id: randomUUID(),
                        name: menuMeal.title,
                        items: menuMeal.items.map((i) => ({ ...i, id: randomUUID() })),
                      });
                      recordsChanged();
                    }, 'Modelo salvo. Nenhum consumo adicional foi registrado.'),
                },
                {
                  label: 'Excluir refeição',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () =>
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
                              await diary!.deleteMeal(snapshot!.profile.id, menuMeal.id);
                              recordsChanged();
                            }, 'Refeição excluída.'),
                        },
                      ],
                    ),
                },
              ]
            : []
        }
      />
    </Screen>
  );
}
