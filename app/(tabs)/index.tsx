import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { useApp } from '../../src/shared/app-provider';
import { Card, Header, NavRow, Notice, Screen, Txt } from '../../src/shared/components/ui';
import { useTheme } from '../../src/shared/theme/theme';

export default function TodayScreen() {
  const { snapshot } = useApp();
  const { colors } = useTheme();
  const profile = snapshot!.profile;
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: profile.timezone,
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
  return (
    <Screen>
      <Header
        eyebrow={`Evolução / ${date}`}
        title={`Olá, ${profile.displayName}.`}
        description="Sua rotina, vista com clareza."
      />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="checkmark-circle-outline" color={colors.success} size={24} />
          <Txt kind="label">Perfil salvo neste dispositivo</Txt>
        </View>
        <Txt kind="heading">O primeiro passo está pronto.</Txt>
        <Txt kind="muted">
          Seu perfil, suas preferências e suas referências já ficam guardados localmente.
        </Txt>
        <Notice>
          Fase 0 · Fundação. Os registros diários entram a partir da próxima fase. Esta versão ainda
          não é um diário de saúde completo.
        </Notice>
      </Card>
      <View>
        <Txt kind="heading">Seu espaço</Txt>
        <NavRow
          title="Revisar perfil"
          detail="Dados de referência e fuso horário"
          href="/settings/profile"
          icon="person-outline"
        />
        <NavRow
          title="Ajustar preferências"
          detail="Aparência, indicadores e rotina"
          href="/settings/preferences"
          icon="options-outline"
        />
        <NavRow
          title="Consultar referências"
          detail="Metas confirmadas na revisão inicial"
          href="/settings/goals"
          icon="flag-outline"
        />
      </View>
      <Card>
        <Txt kind="eyebrow">Privado por padrão</Txt>
        <Txt kind="muted">
          Sem conta, anúncios ou envio automático de informações. Nenhuma medição ou atividade foi
          criada pelo onboarding.
        </Txt>
      </Card>
    </Screen>
  );
}
