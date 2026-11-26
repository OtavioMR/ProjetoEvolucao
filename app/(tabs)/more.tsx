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
        title="Água e outras bebidas"
        detail="Registros por dia, volumes rápidos e histórico"
        href="/hydration"
        icon="water-outline"
      />
      <NavRow
        title="Sono e descanso"
        detail="Intervalos noturnos, cochilos e qualidade"
        href="/progress/sleep"
        icon="moon-outline"
      />
      <NavRow
        title="Hábitos"
        detail="Checklist diário sem culpa e arquivamento"
        href="/progress/habits"
        icon="checkmark-circle-outline"
      />
      <NavRow
        title="Calendário mensal"
        detail="Visão mensal com filtros e acesso ao dia"
        href="/progress/calendar"
        icon="calendar-outline"
      />
      <NavRow
        title="Revisão semanal e mensal"
        detail="Cobertura, notas e resumo copiável"
        href="/progress/review"
        icon="document-text-outline"
      />
      <NavRow
        title="Backup local e CSV"
        detail="Exportar JSON/CSV e restaurar com prévia e confirmação"
        href="/settings/backup"
        icon="download-outline"
      />
      <NavRow
        title="Lembretes locais"
        detail="Notificações opcionais por categoria e horário de silêncio"
        href="/settings/reminders"
        icon="notifications-outline"
      />
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
        title="Metas e vigências"
        detail="Referências atuais e histórico versionado"
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
        Evolução · Diário, água, treinos, evolução, sono, hábitos, calendário, revisão, CSV,
        lembretes locais e exclusão total disponíveis neste dispositivo.
      </Txt>
    </Screen>
  );
}
