import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { backupLimit, parseBackup, type Backup } from '../../domain/backup/backup';
import { useApp } from '../../shared/app-provider';
import { Button, Card, Field, Header, Notice, Screen, Txt } from '../../shared/components/ui';
import { useAction } from '../diary/use-diary';

export function BackupScreen() {
  const { backup, reloadProfile } = useApp();
  const [preview, setPreview] = useState<Backup | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [exportOffered, setExportOffered] = useState(false);
  const [validation, setValidation] = useState('');
  const action = useAction();
  async function exportFile() {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível.');
    const content = JSON.stringify(await backup!.export());
    parseBackup(content);
    const file = new File(Paths.cache, `evolucao-backup-${randomUUID()}.json`);
    file.create();
    file.write(content);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Salvar backup privado do Evolução',
    });
  }
  return (
    <Screen insetTop={false}>
      <Header
        eyebrow="Configurações / Backup"
        title="Uma cópia sob seu controle."
        description="Backup JSON do perfil, preferências, metas, catálogo, receitas, modelos, refeições e água."
      />
      <Notice>
        O arquivo contém dados pessoais e de saúde e não é criptografado. Escolha onde guardar e com
        quem compartilhar. Nenhum arquivo é enviado automaticamente.
      </Notice>
      <Button
        title="Exportar backup JSON"
        busy={action.busy}
        onPress={() =>
          void action.run(
            exportFile,
            'Se você salvou o arquivo no seletor do sistema, guarde essa cópia em um local seguro.',
          )
        }
      />
      <Button
        secondary
        title="Selecionar backup para prévia"
        busy={action.busy}
        onPress={() =>
          void action.run(async () => {
            setPreview(null);
            setConfirmation('');
            setExportOffered(false);
            setValidation('');
            const result = await getDocumentAsync({
              type: ['application/json', 'text/plain', 'application/octet-stream'],
              copyToCacheDirectory: true,
              multiple: false,
            });
            if (result.canceled) return;
            const asset = result.assets[0]!;
            const file = new File(asset.uri);
            if ((asset.size ?? file.size) > backupLimit || file.size > backupLimit)
              throw new Error('Arquivo maior que 10 MiB.');
            try {
              setPreview(parseBackup(await file.text()));
            } catch {
              setValidation(
                'Arquivo inválido, versão não suportada ou vínculos inconsistentes. Os dados atuais foram preservados.',
              );
            }
          }, '')
        }
      />
      {action.message ? <Notice error={action.failed}>{action.message}</Notice> : null}
      {validation ? <Notice error>{validation}</Notice> : null}
      {preview ? (
        <Card>
          <Txt kind="heading">Prévia da restauração</Txt>
          <Txt kind="muted">
            Exportado em {new Date(preview.exportedAt).toLocaleString('pt-BR')} · formato 1 / banco
            2
          </Txt>
          <Txt>
            {preview.tables.meals.length} refeições · {preview.tables.meal_items.length} itens ·{' '}
            {preview.tables.water_entries.length} bebidas
          </Txt>
          <Txt>
            {preview.tables.foods.length} alimentos · {preview.tables.recipes.length} receitas ·{' '}
            {preview.tables.meal_templates.length} modelos
          </Txt>
          <Txt>
            1 perfil · 1 conjunto de preferências · {preview.tables.goal_versions.length} versões de
            metas
          </Txt>
          <Notice>
            A restauração substitui todos os dados atuais pelos dados do arquivo. IDs iguais não
            serão mesclados. Exporte os registros atuais antes de continuar.
          </Notice>
          {!exportOffered ? (
            <>
              <Button
                secondary
                title="Exportar dados atuais antes de restaurar"
                busy={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await exportFile();
                    setExportOffered(true);
                  }, 'Confira se salvou a cópia antes de confirmar a substituição.')
                }
              />
              <Button
                secondary
                title="Continuar sem exportar dados atuais"
                onPress={() => setExportOffered(true)}
              />
            </>
          ) : (
            <>
              <Field
                label="Digite SUBSTITUIR para confirmar"
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
              />
              <Button
                title="Restaurar e substituir dados locais"
                busy={action.busy}
                onPress={() => {
                  if (confirmation !== 'SUBSTITUIR') {
                    setValidation(
                      'Digite SUBSTITUIR para confirmar a troca de todos os registros.',
                    );
                    return;
                  }
                  setValidation('');
                  void action.run(async () => {
                    await backup!.restore(preview);
                    await reloadProfile();
                    setPreview(null);
                    setConfirmation('');
                  }, 'Backup restaurado neste dispositivo.');
                }}
              />
            </>
          )}
        </Card>
      ) : null}
      <Txt kind="muted">
        Limites: 10 MiB e 20.000 registros por backup. Versões futuras são recusadas. Não há fotos
        neste formato. Reinstalação ou perda do dispositivo pode apagar o banco local.
      </Txt>
    </Screen>
  );
}
