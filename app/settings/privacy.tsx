import { Card, Header, Notice, Screen, Txt } from '../../src/shared/components/ui';
export default function PrivacyScreen() {
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Privacidade"
        title="Seus dados ficam aqui."
        description="Armazenamento local, sem conta ou sincronização."
      />
      <Card>
        <Txt kind="heading">No armazenamento do aplicativo</Txt>
        <Txt kind="muted">
          Perfil, diário, água e referências são salvos em SQLite no espaço privado do app. O banco
          não possui criptografia própria. A proteção depende também do sistema operacional e do
          bloqueio do dispositivo.
        </Txt>
      </Card>
      <Card>
        <Txt kind="heading">Escolhas sob seu controle</Txt>
        <Txt kind="muted">
          Não coletamos telemetria nem enviamos seus registros a servidores. Não solicitamos
          localização, contatos, microfone ou acesso amplo a arquivos. Ocultar indicadores mantém os
          dados existentes.
        </Txt>
      </Card>
      <Notice>
        Sem sincronização, reinstalar o app ou perder o aparelho pode causar perda de dados. Backup
        e restauração em JSON estão disponíveis em Mais → Backup local. Cópias exportadas exigem
        cuidado e não são criptografadas pelo aplicativo.
      </Notice>
      <Txt kind="muted">
        O backup automático Android está desabilitado na configuração do aplicativo instalado. Expo
        Go e políticas do sistema podem se comportar de outra forma. Exclusão total com confirmação
        e lembretes locais fazem parte da Fase 4.
      </Txt>
    </Screen>
  );
}
