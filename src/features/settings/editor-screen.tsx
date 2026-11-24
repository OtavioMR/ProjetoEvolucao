import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { setupSchema, unusualProfileValues, type SetupInput } from '../../domain/profile/profile';
import { useApp } from '../../shared/app-provider';
import { Button, Header, Notice, Screen, Toggle } from '../../shared/components/ui';
import { PreferenceFields, ProfileFields, VisibilityFields } from './form-fields';
import { useSaveForm } from './use-save-form';

export function EditorScreen({ section }: { section: 'profile' | 'preferences' }) {
  const { snapshot, updateProfile, updatePreferences } = useApp();
  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      profile: snapshot!.profile,
      preferences: snapshot!.preferences,
      goals: {
        water: null,
        energy: null,
        protein: null,
        carbs: null,
        fat: null,
        sleep: null,
        cardio: null,
      },
    },
  });
  const { save, busy, error, saved } = useSaveForm();
  const [unusual, setUnusual] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const submit = form.handleSubmit(async (input) => {
    if (section === 'profile' && unusualProfileValues(input.profile) && !confirmed) {
      setUnusual(true);
      return;
    }
    await save(async () => {
      if (section === 'profile') await updateProfile(input.profile);
      else await updatePreferences(input.preferences);
      form.reset(input);
    });
  });
  return (
    <Screen insetTop={false}>
      <FormProvider {...form}>
        <Header
          eyebrow="Configurações"
          title={section === 'profile' ? 'Seu perfil' : 'Preferências'}
          description={
            section === 'profile'
              ? 'Contexto editável, sem alterar registros realizados.'
              : 'Escolha a aparência e o que deseja acompanhar.'
          }
        />
        {section === 'profile' ? (
          <ProfileFields />
        ) : (
          <>
            <VisibilityFields />
            <PreferenceFields />
          </>
        )}
        {unusual && (
          <>
            <Notice>Confira os valores e as unidades antes de salvar.</Notice>
            <Toggle
              title="Revisei e confirmo esses valores"
              value={confirmed}
              onChange={setConfirmed}
            />
          </>
        )}
        {error && <Notice error>{error}</Notice>}
        {saved && !form.formState.isDirty && (
          <Notice>Salvo. As alterações já estão disponíveis no aplicativo.</Notice>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <Notice error>
            Revise os campos destacados. Abra os horários e a rotina para conferir todos os campos.
          </Notice>
        )}
        <Button
          title="Salvar alterações"
          busy={busy}
          onPress={() => {
            void submit();
          }}
          icon="checkmark"
        />
      </FormProvider>
    </Screen>
  );
}
