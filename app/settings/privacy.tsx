import { useState } from 'react';

import { useAction } from '../../src/features/diary/use-diary';
import { useApp } from '../../src/shared/app-provider';
import { Button, Card, Field, Header, Notice, Screen, Txt } from '../../src/shared/components/ui';

export default function PrivacyScreen() {
  const { eraseAllLocalData } = useApp();
  const [confirmation, setConfirmation] = useState('');
  const [validation, setValidation] = useState('');
  const action = useAction();

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
          Perfil, diário, treinos, evolução, lembretes e referências são salvos em SQLite no espaço
          privado do app. O banco não possui criptografia própria. A proteção depende também do
          sistema operacional e do bloqueio do dispositivo.
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
      <Card>
        <Txt kind="heading">Exclusão total dos dados locais</Txt>
        <Txt kind="muted">
          Esta ação apaga permanentemente todos os registros do SQLite neste dispositivo, remove
          arquivos temporários gerados pelo aplicativo, cancela lembretes agendados e retorna ao
          onboarding inicial. Cópias externas já salvas por você (como arquivos JSON ou CSV) não são
          apagadas.
        </Txt>
        <Field
          label="Digite APAGAR TUDO para confirmar"
          value={confirmation}
          onChangeText={(text) => {
            setConfirmation(text);
            if (validation) setValidation('');
          }}
          autoCapitalize="characters"
        />
        {validation ? <Notice error>{validation}</Notice> : null}
        {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
        <Button
          secondary
          title="Apagar todos os dados locais"
          busy={action.busy}
          icon="trash-outline"
          onPress={() => {
            if (confirmation.trim() !== 'APAGAR TUDO') {
              setValidation('Digite APAGAR TUDO exatamente para confirmar a exclusão total.');
              return;
            }
            setValidation('');
            void action.run(async () => {
              await eraseAllLocalData();
              setConfirmation('');
            }, '');
          }}
        />
      </Card>
      <Txt kind="muted">
        O backup automático Android está desabilitado na configuração do aplicativo instalado. Expo
        Go e políticas do sistema podem se comportar de outra forma.
      </Txt>
    </Screen>
  );
}
