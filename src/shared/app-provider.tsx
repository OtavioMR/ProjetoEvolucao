import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { DatabaseQueue } from '../core/database/connection';
import { migrateDatabase } from '../core/database/migrate';
import { ProfileRepository } from '../core/database/repositories/profile-repository';
import { DiaryRepository } from '../core/database/repositories/diary-repository';
import { BackupRepository } from '../core/database/repositories/backup-repository';
import { EvolutionRepository } from '../core/database/repositories/evolution-repository';
import { ReminderRepository } from '../core/database/repositories/reminder-repository';
import { TrainingRepository } from '../core/database/repositories/training-repository';
import { localDateAt } from '../core/date-time/local-date';
import {
  cancelAllScheduledReminders,
  syncScheduledReminders,
} from '../core/notifications/reminder-scheduler';
import type {
  AppSnapshot,
  GoalMetric,
  Preferences,
  ProfileInput,
  SetupInput,
} from '../domain/profile/profile';

type AppContextValue = {
  diary: DiaryRepository | null;
  training: TrainingRepository | null;
  evolution: EvolutionRepository | null;
  backup: BackupRepository | null;
  reminders: ReminderRepository | null;
  selectedDate: string;
  selectDate: (date: string) => void;
  revision: number;
  recordsChanged: () => void;
  reloadProfile: () => Promise<void>;
  eraseAllLocalData: () => Promise<void>;
  status: 'loading' | 'ready' | 'error';
  snapshot: AppSnapshot | null;
  retry: () => void;
  createProfile: (input: SetupInput) => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<void>;
  updatePreferences: (input: Preferences) => Promise<void>;
  upsertGoal: (
    metric: GoalMetric,
    targetValue: number,
    effectiveFromDate: string,
    enabled: boolean,
  ) => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AppContextValue['status']>('loading');
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const repository = useRef<ProfileRepository | null>(null);
  const [services, setServices] = useState<{
    diary: DiaryRepository;
    training: TrainingRepository;
    evolution: EvolutionRepository;
    backup: BackupRepository;
    reminders: ReminderRepository;
  } | null>(null);
  const [selectedDate, selectDate] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let close: (() => Promise<void>) | undefined;
    let initialized = false;
    async function initialize() {
      try {
        const db = await openDatabaseAsync('evolucao.db');
        close = () => db.closeAsync();
        await migrateDatabase(db);
        const queue = new DatabaseQueue(db);
        const repo = new ProfileRepository(queue, randomUUID);
        const data = await repo.read();
        if (cancelled) {
          await close();
          return;
        }
        repository.current = repo;
        setServices({
          diary: new DiaryRepository(queue),
          training: new TrainingRepository(queue),
          evolution: new EvolutionRepository(queue),
          backup: new BackupRepository(queue),
          reminders: new ReminderRepository(queue, randomUUID),
        });
        selectDate(localDateAt(new Date(), data?.profile.timezone ?? 'America/Sao_Paulo'));
        initialized = true;
        setSnapshot(data);
        setStatus('ready');
      } catch {
        await close?.().catch(() => undefined);
        if (!cancelled) setStatus('error');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      repository.current = null;
      if (initialized) void close?.().catch(() => undefined);
    };
  }, [attempt]);

  const execute = useCallback(async (work: (repo: ProfileRepository) => Promise<void>) => {
    const repo = repository.current;
    if (!repo) throw new Error('database_unavailable');
    await work(repo);
    setSnapshot(await repo.read());
  }, []);

  return (
    <AppContext.Provider
      value={{
        diary: services?.diary ?? null,
        training: services?.training ?? null,
        evolution: services?.evolution ?? null,
        backup: services?.backup ?? null,
        reminders: services?.reminders ?? null,
        selectedDate,
        selectDate,
        revision,
        recordsChanged: () => setRevision((n) => n + 1),
        reloadProfile: async () => {
          if (!repository.current) throw new Error('database_unavailable');
          setSnapshot(await repository.current.read());
          setRevision((n) => n + 1);
        },
        eraseAllLocalData: async () => {
          if (!services?.backup) throw new Error('database_unavailable');
          await cancelAllScheduledReminders();
          for (const dir of [Paths.cache, Paths.document]) {
            try {
              const entries = new Directory(dir).list();
              for (const entry of entries) {
                if (entry instanceof File && entry.name.startsWith('evolucao-')) {
                  entry.delete();
                }
              }
            } catch {
              // Diretório opcional em ambiente web/teste.
            }
          }
          await services.backup.eraseAllData();
          setSnapshot(null);
          selectDate('');
          setRevision((n) => n + 1);
        },
        status,
        snapshot,
        retry: () => {
          setStatus('loading');
          setAttempt((n) => n + 1);
        },
        createProfile: (input) =>
          execute(async (repo) => {
            await repo.create(input);
            selectDate(localDateAt(new Date(), input.profile.timezone));
          }),
        updateProfile: (input) =>
          execute(async (repo) => {
            if (!snapshot) throw new Error('profile_not_found');
            await repo.updateProfile(snapshot.profile.id, input);
            if (services?.reminders) {
              await syncScheduledReminders(
                services.reminders,
                snapshot.profile.id,
                input.timezone,
              ).catch(() => undefined);
            }
          }),
        updatePreferences: (input) =>
          execute(async (repo) => {
            if (!snapshot) throw new Error('profile_not_found');
            await repo.updatePreferences(snapshot.profile.id, input);
            if (services?.reminders) {
              await syncScheduledReminders(
                services.reminders,
                snapshot.profile.id,
                snapshot.profile.timezone,
              ).catch(() => undefined);
            }
          }),
        upsertGoal: (metric, targetValue, effectiveFromDate, enabled) =>
          execute(async (repo) => {
            if (!snapshot) throw new Error('profile_not_found');
            await repo.upsertGoalVersion(
              snapshot.profile.id,
              metric,
              targetValue,
              effectiveFromDate,
              enabled,
            );
          }),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider required');
  return context;
}
