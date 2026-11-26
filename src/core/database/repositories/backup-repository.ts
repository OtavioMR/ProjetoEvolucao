import {
  backupTables,
  validateBackup,
  type Backup,
  type BackupRow,
} from '../../../domain/backup/backup.ts';
import { buildCsv, type CsvCell, type CsvModule } from '../../../domain/backup/csv.ts';
import { DatabaseQueue } from '../connection.ts';

export class BackupRepository {
  private readonly queue: DatabaseQueue;
  constructor(queue: DatabaseQueue) {
    this.queue = queue;
  }

  export(): Promise<Backup> {
    return this.queue.transaction(async (db) => {
      const tables: Record<string, BackupRow[]> = {};
      for (const table of backupTables)
        tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table} ORDER BY rowid`);
      return validateBackup({
        format: 'evolucao-local',
        formatVersion: 1,
        schemaVersion: 5,
        exportedAt: new Date().toISOString(),
        tables,
      });
    });
  }

  async restore(input: unknown): Promise<void> {
    const backup = validateBackup(input);
    // Congela a cópia validada para não permitir mutações durante a espera pela fila.
    const tables = JSON.parse(JSON.stringify(backup.tables)) as Backup['tables'];
    await this.queue.transaction(async (db) => {
      for (const table of [...backupTables].reverse()) await db.runAsync(`DELETE FROM ${table}`);
      for (const table of backupTables) {
        for (const row of tables[table]) {
          const columns = Object.keys(row);
          // Nomes vieram exclusivamente dos schemas strict e da lista estática de tabelas.
          await db.runAsync(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            ...columns.map((key) => row[key]!),
          );
        }
      }
      if ((await db.getAllAsync('PRAGMA foreign_key_check')).length)
        throw new Error('Backup contém vínculos inválidos.');
    });
  }

  async eraseAllData(): Promise<void> {
    await this.queue.transaction(async (db) => {
      for (const table of [...backupTables].reverse()) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    });
  }

  exportCsvModule(module: CsvModule): Promise<string> {
    return this.queue.run(async (db) => {
      switch (module) {
        case 'nutrition': {
          const meals = await db.getAllAsync<{
            id: string;
            local_date: string;
            occurred_at: string;
            timezone_at_entry: string;
            data: string;
          }>(
            'SELECT id, local_date, occurred_at, timezone_at_entry, data FROM meals ORDER BY local_date DESC, occurred_at DESC',
          );
          const items = await db.getAllAsync<{
            parent_id: string;
            position: number;
            data: string;
          }>('SELECT parent_id, position, data FROM meal_items ORDER BY parent_id, position');
          const byMeal = new Map<string, typeof items>();
          for (const item of items) {
            const list = byMeal.get(item.parent_id) ?? [];
            list.push(item);
            byMeal.set(item.parent_id, list);
          }
          const rows: CsvCell[][] = [];
          for (const meal of meals) {
            const m = JSON.parse(meal.data) as {
              mealType?: string;
              title?: string;
              context?: string | null;
              notes?: string;
            };
            const mealItems = byMeal.get(meal.id) ?? [];
            if (mealItems.length === 0) {
              rows.push([
                meal.local_date,
                meal.occurred_at,
                meal.timezone_at_entry,
                m.mealType ?? '',
                m.title ?? '',
                '',
                null,
                '',
                null,
                null,
                null,
                null,
                m.context ?? '',
                m.notes ?? '',
              ]);
              continue;
            }
            for (const item of mealItems) {
              const it = JSON.parse(item.data) as {
                nameSnapshot?: string;
                quantity?: number | null;
                unit?: string | null;
                totals?: {
                  kcal?: number | null;
                  proteinG?: number | null;
                  carbsG?: number | null;
                  fatG?: number | null;
                };
              };
              rows.push([
                meal.local_date,
                meal.occurred_at,
                meal.timezone_at_entry,
                m.mealType ?? '',
                m.title ?? '',
                it.nameSnapshot ?? '',
                it.quantity ?? null,
                it.unit ?? '',
                it.totals?.kcal ?? null,
                it.totals?.proteinG ?? null,
                it.totals?.carbsG ?? null,
                it.totals?.fatG ?? null,
                m.context ?? '',
                m.notes ?? '',
              ]);
            }
          }
          return buildCsv(
            [
              'data_local',
              'horario_utc',
              'fuso',
              'tipo_refeicao',
              'titulo_refeicao',
              'item',
              'quantidade',
              'unidade',
              'energia_kcal',
              'proteina_g',
              'carboidratos_g',
              'gordura_g',
              'contexto',
              'observacoes',
            ],
            rows,
          );
        }
        case 'hydration': {
          const rows = await db.getAllAsync<{
            local_date: string;
            occurred_at: string;
            timezone_at_entry: string;
            amount_ml: number;
            beverage_type: string;
            notes: string;
          }>(
            'SELECT local_date, occurred_at, timezone_at_entry, amount_ml, beverage_type, notes FROM water_entries ORDER BY local_date DESC, occurred_at DESC',
          );
          return buildCsv(
            ['data_local', 'horario_utc', 'fuso', 'volume_ml', 'tipo_bebida', 'observacoes'],
            rows.map((r) => [
              r.local_date,
              r.occurred_at,
              r.timezone_at_entry,
              r.amount_ml,
              r.beverage_type,
              r.notes,
            ]),
          );
        }
        case 'training': {
          const sessions = await db.getAllAsync<{
            id: string;
            local_date: string;
            started_at: string;
            completed_at: string | null;
            timezone_at_entry: string;
            status: string;
            data: string;
          }>(
            'SELECT id, local_date, started_at, completed_at, timezone_at_entry, status, data FROM workout_sessions ORDER BY local_date DESC, started_at DESC',
          );
          const exercises = await db.getAllAsync<{
            id: string;
            session_id: string;
            position: number;
            data: string;
          }>(
            'SELECT id, session_id, position, data FROM workout_session_exercises ORDER BY session_id, position',
          );
          const sets = await db.getAllAsync<{
            session_exercise_id: string;
            position: number;
            data: string;
          }>(
            'SELECT session_exercise_id, position, data FROM workout_sets ORDER BY session_exercise_id, position',
          );
          const setsByEx = new Map<string, typeof sets>();
          for (const s of sets) {
            const list = setsByEx.get(s.session_exercise_id) ?? [];
            list.push(s);
            setsByEx.set(s.session_exercise_id, list);
          }
          const exBySession = new Map<string, typeof exercises>();
          for (const ex of exercises) {
            const list = exBySession.get(ex.session_id) ?? [];
            list.push(ex);
            exBySession.set(ex.session_id, list);
          }
          const rows: CsvCell[][] = [];
          for (const session of sessions) {
            const sData = JSON.parse(session.data) as { titleSnapshot?: string };
            const sessionExs = exBySession.get(session.id) ?? [];
            for (const ex of sessionExs) {
              const exData = JSON.parse(ex.data) as { nameSnapshot?: string };
              const exSets = setsByEx.get(ex.id) ?? [];
              for (const set of exSets) {
                const st = JSON.parse(set.data) as {
                  setKind?: string;
                  loadKg?: number | null;
                  repetitions?: number | null;
                  durationSec?: number | null;
                  rir?: number | null;
                  status?: string;
                  notes?: string;
                };
                rows.push([
                  session.local_date,
                  session.started_at,
                  session.completed_at ?? '',
                  session.timezone_at_entry,
                  session.status,
                  sData.titleSnapshot ?? '',
                  exData.nameSnapshot ?? '',
                  set.position + 1,
                  st.setKind ?? '',
                  st.loadKg ?? null,
                  st.repetitions ?? null,
                  st.durationSec ?? null,
                  st.rir ?? null,
                  st.status ?? '',
                  st.notes ?? '',
                ]);
              }
            }
          }
          return buildCsv(
            [
              'data_local',
              'inicio_utc',
              'fim_utc',
              'fuso',
              'status_sessao',
              'titulo_sessao',
              'exercicio',
              'serie',
              'tipo_serie',
              'carga_kg',
              'repeticoes',
              'duracao_s',
              'rir',
              'status_serie',
              'observacoes',
            ],
            rows,
          );
        }
        case 'cardio': {
          const rows = await db.getAllAsync<{
            local_date: string;
            occurred_at: string;
            timezone_at_entry: string;
            duration_minutes: number;
            distance_km: number | null;
            session_id: string | null;
            data: string;
          }>(
            'SELECT local_date, occurred_at, timezone_at_entry, duration_minutes, distance_km, session_id, data FROM cardio_entries ORDER BY local_date DESC, occurred_at DESC',
          );
          return buildCsv(
            [
              'data_local',
              'horario_utc',
              'fuso',
              'atividade',
              'duracao_min',
              'distancia_km',
              'esforco_1_10',
              'vinculado_treino',
              'observacoes',
            ],
            rows.map((r) => {
              const d = JSON.parse(r.data) as {
                activityType?: string;
                effort?: number | null;
                notes?: string;
              };
              return [
                r.local_date,
                r.occurred_at,
                r.timezone_at_entry,
                d.activityType ?? '',
                r.duration_minutes,
                r.distance_km,
                d.effort ?? null,
                Boolean(r.session_id),
                d.notes ?? '',
              ];
            }),
          );
        }
        case 'weight': {
          const rows = await db.getAllAsync<{
            local_date: string;
            occurred_at: string;
            timezone_at_entry: string;
            weight_kg: number;
            notes: string;
          }>(
            'SELECT local_date, occurred_at, timezone_at_entry, weight_kg, notes FROM weight_entries ORDER BY local_date DESC, occurred_at DESC',
          );
          return buildCsv(
            ['data_local', 'horario_utc', 'fuso', 'peso_kg', 'observacoes'],
            rows.map((r) => [
              r.local_date,
              r.occurred_at,
              r.timezone_at_entry,
              r.weight_kg,
              r.notes,
            ]),
          );
        }
        case 'measurements': {
          const rows = await db.getAllAsync<{
            local_date: string;
            occurred_at: string;
            timezone_at_entry: string;
            metric: string;
            value_cm: number;
            notes: string;
          }>(
            'SELECT local_date, occurred_at, timezone_at_entry, metric, value_cm, notes FROM measurement_entries ORDER BY local_date DESC, occurred_at DESC',
          );
          return buildCsv(
            ['data_local', 'horario_utc', 'fuso', 'medida', 'valor_cm', 'observacoes'],
            rows.map((r) => [
              r.local_date,
              r.occurred_at,
              r.timezone_at_entry,
              r.metric,
              r.value_cm,
              r.notes,
            ]),
          );
        }
        case 'sleep': {
          const rows = await db.getAllAsync<{
            wake_local_date: string;
            start_at: string;
            end_at: string;
            timezone_at_entry: string;
            is_nap: number;
            quality: number | null;
            notes: string;
          }>(
            'SELECT wake_local_date, start_at, end_at, timezone_at_entry, is_nap, quality, notes FROM sleep_entries ORDER BY wake_local_date DESC, end_at DESC',
          );
          return buildCsv(
            [
              'data_despertar',
              'inicio_utc',
              'fim_utc',
              'fuso',
              'cochilo',
              'qualidade_1_5',
              'observacoes',
            ],
            rows.map((r) => [
              r.wake_local_date,
              r.start_at,
              r.end_at,
              r.timezone_at_entry,
              r.is_nap === 1,
              r.quality,
              r.notes,
            ]),
          );
        }
        case 'habits': {
          const rows = await db.getAllAsync<{
            local_date: string;
            status: string;
            notes: string;
            habit_data: string;
          }>(
            `SELECT hl.local_date, hl.status, hl.notes, h.data AS habit_data
             FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             ORDER BY hl.local_date DESC`,
          );
          return buildCsv(
            ['data_local', 'habito', 'status', 'observacoes'],
            rows.map((r) => {
              const h = JSON.parse(r.habit_data) as { title?: string };
              return [r.local_date, h.title ?? '', r.status, r.notes];
            }),
          );
        }
      }
    });
  }
}
