import { useApp } from '../../src/shared/app-provider';
import { Card, Header, NavRow, Screen, Txt } from '../../src/shared/components/ui';

export default function MoreScreen() {
  const { snapshot } = useApp();
  return (
    <Screen>
      <Header
        eyebrow="Evolução / Mais"
        title="Do seu jeito."
        description="Um espaço para suas escolhas e seus dados."
      />
      <Card>
        <Txt kind="heading">{snapshot!.profile.displayName}</Txt>
        <Txt kind="muted">Perfil local · {snapshot!.profile.timezone}</Txt>
      </Card>
      <NavRow
        title="Perfil"
        detail="Nome, referências corporais e fuso"
        href="/settings/profile"
        icon="person-outline"
      />
      <NavRow
        title="Preferências"
        detail="Tema, indicadores, horários e dias disponíveis"
        href="/settings/preferences"
        icon="options-outline"
      />
      <NavRow
        title="Referências iniciais"
        detail="Valores confirmados no onboarding"
        href="/settings/goals"
        icon="flag-outline"
      />
      <NavRow
        title="Privacidade e armazenamento"
        detail="Como os dados ficam neste dispositivo"
        href="/settings/privacy"
        icon="shield-checkmark-outline"
      />
      <Txt kind="muted">
        Evolução 0.1.0 · Fase 0. Água e alimentação: Fase 1. Treinos: Fase 2. Sono, hábitos e
        relatórios: Fase 3. Lembretes e distribuição: Fase 4.
      </Txt>
    </Screen>
  );
}
