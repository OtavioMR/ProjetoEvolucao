import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';
import { useState } from 'react';

import { onboardingDefaults } from '../../domain/profile/defaults';
import { setupSchema, unusualProfileValues, type SetupInput } from '../../domain/profile/profile';
import { useApp } from '../../shared/app-provider';
import { Button, Header, Notice, Screen, Toggle, Txt } from '../../shared/components/ui';
import { GoalFields, PreferenceFields, ProfileFields, VisibilityFields } from './form-fields';
import { useSaveForm } from './use-save-form';

export function SetupScreen() {
  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues: onboardingDefaults(),
  });
  const { createProfile } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [confirmUnusual, setConfirmUnusual] = useState(false);
  const [unusual, setUnusual] = useState(false);
  const { save, busy, error } = useSaveForm();
  const titles = ['Um começo com a sua cara.', 'Acompanhe do seu jeito.', 'Pronto para começar.'];
  async function next() {
    const valid = await form.trigger(step === 0 ? 'profile' : ['goals', 'preferences.visibility']);
    if (valid) setStep((n) => n + 1);
  }
  const submit = form.handleSubmit(async (input) => {
    if (unusualProfileValues(input.profile) && !confirmUnusual) {
      setUnusual(true);
      return;
    }
    await save(async () => {
      await createProfile(input);
      router.replace('/(tabs)');
    });
  });
  return (
    <Screen key={step}>
      <FormProvider {...form}>
        <Header
          eyebrow={`Evolução / ${step + 1} de 3`}
          title={titles[step] ?? ''}
          description="Um espaço pessoal para registrar sua rotina. Seus dados ficam neste dispositivo."
        />
        {step === 0 && (
          <>
            <ProfileFields />
            <Notice>
              Revise os valores antes de confirmar. Nenhuma refeição, sessão de treino ou pesagem
              será registrada nesta etapa.
            </Notice>
          </>
        )}
        {step === 1 && (
          <>
            <VisibilityFields />
            <GoalFields />
          </>
        )}
        {step === 2 && (
          <>
            <PreferenceFields />
            <Notice>
              O banco local não possui criptografia própria. Sem sincronização, reinstalar o app ou
              perder o aparelho pode causar perda de dados. Backup será entregue na Fase 1.
            </Notice>
            <Txt kind="muted">
              Esta versão entrega a fundação. Os diários serão adicionados nas próximas fases.
            </Txt>
          </>
        )}
        {unusual && (
          <>
            <Notice>
              Há valores fora do intervalo habitual. Confira se as unidades e a digitação estão
              corretas.
            </Notice>
            <Toggle
              title="Revisei e confirmo esses valores"
              value={confirmUnusual}
              onChange={setConfirmUnusual}
            />
          </>
        )}
        {error && <Notice error>{error}</Notice>}
        {Object.keys(form.formState.errors).length > 0 && (
          <Notice error>
            Revise os campos destacados antes de continuar. Se necessário, abra os horários e a
            rotina.
          </Notice>
        )}
        <Button
          title={step < 2 ? 'Continuar' : 'Confirmar perfil e começar'}
          busy={busy}
          icon="arrow-forward"
          onPress={() => {
            void (step < 2 ? next() : submit());
          }}
        />
        {step > 0 && (
          <Button title="Voltar para revisar" secondary onPress={() => setStep((n) => n - 1)} />
        )}
      </FormProvider>
    </Screen>
  );
}
