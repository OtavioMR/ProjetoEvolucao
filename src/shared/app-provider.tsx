import { randomUUID } from 'expo-crypto';
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
import type { AppSnapshot, Preferences, ProfileInput, SetupInput } from '../domain/profile/profile';

type AppContextValue = {
  status: 'loading' | 'ready' | 'error';
  snapshot: AppSnapshot | null;
  retry: () => void;
  createProfile: (input: SetupInput) => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<void>;
  updatePreferences: (input: Preferences) => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AppContextValue['status']>('loading');
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const repository = useRef<ProfileRepository | null>(null);

  useEffect(() => {
    let cancelled = false;
    let close: (() => Promise<void>) | undefined;
    let initialized = false;
    async function initialize() {
      try {
        const db = await openDatabaseAsync('evolucao.db');
        close = () => db.closeAsync();
        await migrateDatabase(db);
        const repo = new ProfileRepository(new DatabaseQueue(db), randomUUID);
        const data = await repo.read();
        if (cancelled) {
          await close();
          return;
        }
        repository.current = repo;
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
        status,
        snapshot,
        retry: () => {
          setStatus('loading');
          setAttempt((n) => n + 1);
        },
        createProfile: (input) => execute((repo) => repo.create(input)),
        updateProfile: (input) =>
          execute(async (repo) => {
            if (!snapshot) throw new Error('profile_not_found');
            await repo.updateProfile(snapshot.profile.id, input);
          }),
        updatePreferences: (input) =>
          execute(async (repo) => {
            if (!snapshot) throw new Error('profile_not_found');
            await repo.updatePreferences(snapshot.profile.id, input);
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
