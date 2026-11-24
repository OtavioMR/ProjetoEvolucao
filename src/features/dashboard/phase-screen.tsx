import { Card, Header, NavRow, Notice, Screen, Txt } from '../../shared/components/ui';

export function PhaseScreen({
  phase,
  title,
  description,
  items,
}: {
  phase: number;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <Screen>
      <Header eyebrow={`Planejamento / Fase ${phase}`} title={title} description={description} />
      <Notice>
        Este módulo está no backlog. Não há registros ou cálculos simulados nesta versão.
      </Notice>
      <Card>
        <Txt kind="heading">Escopo da entrega</Txt>
        {items.map((item, index) => (
          <Txt key={item} kind="muted">
            {String(index + 1).padStart(2, '0')} · {item}
          </Txt>
        ))}
      </Card>
      <NavRow
        title="Configurar o que acompanhar"
        detail="Suas preferências já são salvas localmente"
        href="/settings/preferences"
        icon="options-outline"
      />
    </Screen>
  );
}
