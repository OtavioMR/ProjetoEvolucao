import { Controller, useFormContext } from 'react-hook-form';
import { useState } from 'react';
import { View } from 'react-native';

import { parseOptionalNumber, type SetupInput } from '../../domain/profile/profile';
import { Button, Card, Choice, Field, Notice, Toggle, Txt } from '../../shared/components/ui';

export function ProfileFields() {
  const { control } = useFormContext<SetupInput>();
  const numeric = [
    ['ageAtSetup', 'Idade informada (anos)'],
    ['heightCm', 'Altura (cm)'],
    ['referenceWeightKg', 'Peso de referência (kg)'],
    ['targetWeightKg', 'Peso desejado (kg)'],
  ] as const;
  return (
    <Card>
      <Txt kind="heading">Sobre você</Txt>
      <Controller
        control={control}
        name="profile.displayName"
        render={({ field, fieldState }) => (
          <Field
            label="Como quer ser chamado?"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={80}
            error={fieldState.error?.message}
            autoComplete="off"
          />
        )}
      />
      {numeric.map(([key, label]) => (
        <NumberField key={key} name={`profile.${key}`} label={label} />
      ))}
      <Notice>
        Idade e medidas são opcionais. O peso de referência é apenas contexto: nenhuma pesagem será
        criada.
      </Notice>
      <Controller
        control={control}
        name="profile.timezone"
        render={({ field, fieldState }) => (
          <Field
            label="Fuso horário"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            error={fieldState.error?.message}
            hint="Idioma pt-BR · unidades kg, cm, mL e kcal."
          />
        )}
      />
    </Card>
  );
}

function NumberField({
  name,
  label,
}: {
  name:
    | `profile.${'ageAtSetup' | 'heightCm' | 'referenceWeightKg' | 'targetWeightKg'}`
    | `goals.${keyof SetupInput['goals']}`;
  label: string;
}) {
  const { control } = useFormContext<SetupInput>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumericInput
          label={label}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error ? 'Informe um número positivo válido ou deixe vazio.' : undefined}
        />
      )}
    />
  );
}

function NumericInput({
  label,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  error?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));
  return (
    <Field
      label={label}
      value={text}
      onChangeText={(v) => {
        setText(v);
        onChange(parseOptionalNumber(v));
      }}
      onBlur={onBlur}
      keyboardType="decimal-pad"
      placeholder="Opcional"
      error={error}
    />
  );
}

export function GoalFields() {
  const fields = [
    ['water', 'Água (mL/dia)'],
    ['energy', 'Energia (kcal/dia)'],
    ['protein', 'Proteínas (g/dia)'],
    ['carbs', 'Carboidratos (g/dia)'],
    ['fat', 'Gorduras (g/dia)'],
    ['sleep', 'Sono (horas/noite)'],
    ['cardio', 'Cardio (minutos/semana)'],
  ] as const;
  return (
    <Card>
      <Txt kind="heading">Suas referências</Txt>
      <Txt kind="muted">
        Revise, ajuste ou deixe em branco. São referências flexíveis, sem prazos ou compensações.
      </Txt>
      {fields.map(([key, label]) => (
        <NumberField key={key} name={`goals.${key}`} label={label} />
      ))}
      <Notice>
        Estimativas, não orientações médicas individualizadas. Se houver dor persistente, tontura,
        perda de controle alimentar recorrente ou restrições médicas, procure avaliação
        profissional.
      </Notice>
    </Card>
  );
}

export function VisibilityFields() {
  const { control } = useFormContext<SetupInput>();
  const items = [
    ['calories', 'Acompanhar calorias'],
    ['macros', 'Acompanhar macros'],
    ['weight', 'Acompanhar peso'],
    ['measurements', 'Acompanhar medidas'],
    ['sleep', 'Acompanhar sono'],
  ] as const;
  return (
    <Card>
      <Txt kind="heading">O que faz sentido acompanhar?</Txt>
      <Txt kind="muted">Você pode mudar depois. Ocultar um indicador preserva seus registros.</Txt>
      {items.map(([key, label]) => (
        <Controller
          key={key}
          control={control}
          name={`preferences.visibility.${key}`}
          render={({ field }) => (
            <Toggle title={label} value={field.value} onChange={field.onChange} />
          )}
        />
      ))}
    </Card>
  );
}

export function PreferenceFields() {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SetupInput>();
  const [routineOpen, setRoutineOpen] = useState(false);
  const theme = watch('preferences.theme');
  const weekStart = watch('preferences.weekStart');
  const days = watch('preferences.availableDays');
  const meals = watch('preferences.meals');
  const water = watch('preferences.quickWaterAmounts');
  const [waterText, setWaterText] = useState(water.join(', '));
  return (
    <>
      <Card>
        <Txt kind="heading">Seu espaço</Txt>
        <Txt kind="label">Aparência</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['dark', 'Escuro'],
              ['light', 'Claro'],
              ['system', 'Sistema'],
            ] as const
          ).map(([key, label]) => (
            <Choice
              key={key}
              label={label}
              selected={theme === key}
              onPress={() => setValue('preferences.theme', key, { shouldDirty: true })}
            />
          ))}
        </View>
        <Txt kind="label">Início da semana</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Choice
            label="Segunda-feira"
            selected={weekStart === 1}
            onPress={() => setValue('preferences.weekStart', 1, { shouldDirty: true })}
          />
          <Choice
            label="Domingo"
            selected={weekStart === 0}
            onPress={() => setValue('preferences.weekStart', 0, { shouldDirty: true })}
          />
        </View>
        <Field
          label="Porções rápidas de água (mL)"
          value={waterText}
          onChangeText={(v) => {
            setWaterText(v);
            const parts = v.split(',').map((part) => part.trim());
            setValue(
              'preferences.quickWaterAmounts',
              parts.map((part) => (/^\d+$/.test(part) ? Number(part) : NaN)),
              { shouldDirty: true },
            );
          }}
          hint="De 1 a 6 porções, separadas por vírgula. Ex.: 250, 500."
          keyboardType="numbers-and-punctuation"
          error={
            errors.preferences?.quickWaterAmounts
              ? 'Use volumes inteiros de 1 a 10.000 mL, separados por vírgula.'
              : undefined
          }
        />
      </Card>
      <Button
        title={routineOpen ? 'Recolher horários e rotina' : 'Revisar horários e rotina'}
        secondary
        icon={routineOpen ? 'chevron-up' : 'options-outline'}
        onPress={() => setRoutineOpen((v) => !v)}
      />
      {routineOpen && (
        <Card>
          <Txt kind="heading">A rotina pode mudar</Txt>
          <Txt kind="label">Dias disponíveis para treinar</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, day) => (
              <Choice
                key={label}
                label={label}
                selected={days.includes(day)}
                onPress={() =>
                  setValue(
                    'preferences.availableDays',
                    days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
                    { shouldDirty: true },
                  )
                }
              />
            ))}
          </View>
          {(
            [
              ['trainingTime', 'Treino sugerido'],
              ['sleepStart', 'Horário de dormir'],
              ['sleepEnd', 'Horário de despertar'],
            ] as const
          ).map(([key, label]) => (
            <Controller
              key={key}
              control={control}
              name={`preferences.${key}`}
              render={({ field, fieldState }) => (
                <Field
                  label={label}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="HH:mm"
                  keyboardType="numbers-and-punctuation"
                  error={fieldState.error?.message}
                />
              )}
            />
          ))}
          <Txt kind="heading">Refeições habituais</Txt>
          <Txt kind="muted">Configurar horários não registra consumo nem agenda notificações.</Txt>
          {meals.map((_, index) => (
            <View key={index} style={{ gap: 8 }}>
              <Controller
                control={control}
                name={`preferences.meals.${index}.name`}
                render={({ field, fieldState }) => (
                  <Field
                    label={`Nome da refeição ${index + 1}`}
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error ? 'Informe o nome da refeição.' : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name={`preferences.meals.${index}.time`}
                render={({ field, fieldState }) => (
                  <Field
                    label={`Horário da refeição ${index + 1}`}
                    value={field.value}
                    onChangeText={field.onChange}
                    keyboardType="numbers-and-punctuation"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </View>
          ))}
        </Card>
      )}
      <Notice>
        Lembretes estão desativados. A configuração de notificações locais será entregue na Fase 4;
        nenhuma permissão é solicitada agora.
      </Notice>
    </>
  );
}
