import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../../shared/app-provider';
import type { TrainingLibrarySnapshot } from '../../core/database/repositories/training-repository';
import type { CardioEntry, SessionStatus, WorkoutSession } from '../../domain/training/training';

export function useTraining() {
  const app = useApp();
  const { training, snapshot, selectedDate, revision } = app;
  const [data, setData] = useState<{
    date: string;
    key: string;
    library: TrainingLibrarySnapshot;
    activeSession: WorkoutSession | null;
    daySessions: WorkoutSession[];
    dayCardio: CardioEntry[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const queryKey = `${profileId}:${selectedDate}:${revision}:${attempt}`;

  useFocusEffect(
    useCallback(() => {
      let current = true;
      setError(false);
      if (training && profileId && selectedDate) {
        void Promise.all([
          training.library(profileId, true),
          training.activeSession(profileId),
          training.sessionsByDate(profileId, selectedDate),
          training.cardioByDate(profileId, selectedDate),
        ])
          .then(([library, activeSession, daySessions, dayCardio]) => {
            if (current) {
              setData({
                date: selectedDate,
                key: queryKey,
                library,
                activeSession,
                daySessions,
                dayCardio,
              });
            }
          })
          .catch(() => {
            if (current) setError(true);
          });
      }
      return () => {
        current = false;
      };
    }, [training, profileId, selectedDate, queryKey]),
  );

  return {
    ...app,
    data: data?.date === selectedDate && !error ? data : null,
    refreshing: data?.key !== queryKey,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useTrainingHistory(filters: { status?: SessionStatus; templateId?: string } = {}) {
  const app = useApp();
  const { training, snapshot, revision } = app;
  const [data, setData] = useState<{
    key: string;
    sessions: WorkoutSession[];
    cardio: CardioEntry[];
    library: TrainingLibrarySnapshot;
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const { status, templateId } = filters;
  const filterKey = `${profileId}:${status ?? 'all'}:${templateId ?? 'all'}:${revision}:${attempt}`;

  useFocusEffect(
    useCallback(() => {
      let current = true;
      setError(false);
      if (training && profileId) {
        void Promise.all([
          training.history(profileId, { status, templateId, limit: 100 }),
          training.cardioHistory(profileId, 100),
          training.library(profileId, true),
        ])
          .then(([sessions, cardio, library]) => {
            if (current) setData({ key: filterKey, sessions, cardio, library });
          })
          .catch(() => {
            if (current) setError(true);
          });
      }
      return () => {
        current = false;
      };
    }, [training, profileId, status, templateId, filterKey]),
  );

  return {
    ...app,
    data: !error ? data : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
